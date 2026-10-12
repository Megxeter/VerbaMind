"""
Acoustic Analysis Module for Decoded Speech Audio.

Scientific & Architectural Invariants:
- Operates on decoded PCM float32 audio arrays with original timing and silence preserved.
- Pure acoustic measurements are strictly decoupled from linguistic metrics (WER) and
  semantic scoring.
- Detected internal non-speech gaps are physical acoustic duration measurements; they are
  NOT automatically labeled as errors or mistakes (pauses are natural components of breathing,
  phrasing, emphasis, and cognitive planning).
- Speaking rate (WPM) is transcript-derived and explicitly labeled as dependent on speech recognition.
- NEVER computes fake fluency or pronunciation scores.

Detector Specification:
- Method: Short-Time Energy Root Mean Square (RMS) Frame Analysis.
- Frame Duration: 25.0 ms (400 samples at 16 kHz).
- Hop Duration: 10.0 ms (160 samples at 16 kHz).
- Acoustic Energy Metric: Decibels relative to Full Scale (dBFS), where
  dBFS = 20 * log10(RMS + 1e-7). Full-scale sine peak is ~ -3.0 dBFS.
- Default Speech Threshold: -40.0 dBFS.
- Phonetic Smoothing:
  - Hangover window (150 ms): bridges short unvoiced stop consonant closures (p, t, k)
    so natural intra-word closures are not split into distinct speech segments.
  - Minimum speech duration (80 ms): suppresses isolated acoustic clicks or mic pops.
- Internal Non-Speech Gap Threshold: 250 ms (0.25 s). Pauses in speech science literature
  (Goldman-Eisler 1968) are defined as non-speech intervals >= 250 ms. Micro-pauses (< 250 ms)
  are natural phonetic articulatory transitions.
- Units: All durations, timestamps, and gaps are in seconds (s). Sample rates in Hertz (Hz).
  Rates in words per minute (WPM).

Limitations:
- Energy-based VAD does not classify linguistic filler words ("um", "uh"); filler detection
  is deferred to subsequent increments.
- Heavy stationary background noise above -40 dBFS may elevate detected speech time.
"""

from dataclasses import dataclass
import json
from pathlib import Path
import re
from typing import BinaryIO, Union

import numpy as np

from backend.core.config import settings
from backend.services.audio_decoder import decode_audio, AudioDecodeResult



@dataclass(frozen=True)
class AcousticGap:
    """
    An acoustic non-speech interval occurring between active speech segments.
    Physical acoustic measurement; NOT automatically an error or mistake.
    """
    start_seconds: float
    end_seconds: float
    duration_seconds: float


@dataclass(frozen=True)
class AcousticAnalysisResult:
    """
    Structured acoustic measurements and transcript-derived speaking rate.
    """
    # Audio Timing (Pure Acoustic Measurements)
    total_duration_seconds: float
    detected_speech_duration_seconds: float
    speech_activity_ratio: float
    leading_silence_seconds: float
    trailing_silence_seconds: float

    # Internal Non-Speech Gaps (Pure Acoustic Measurements)
    internal_gaps: list[AcousticGap]
    internal_gap_count: int
    total_internal_gap_duration_seconds: float
    mean_internal_gap_duration_seconds: float

    # Transcript-Derived Metrics (Explicitly Labeled as ASR-Dependent)
    transcript_word_count: int | None
    words_per_minute_total: float | None
    words_per_minute_speech_only: float | None
    rate_is_transcript_dependent: bool

    detector_type: str = "frame_energy_rms"
    energy_threshold_db: float = -40.0
    min_gap_duration_seconds: float = 0.25
    sample_rate_hz: int = 16000

    def to_dict(self) -> dict:
        """Serializes acoustic analysis result to a clean dictionary."""
        return {
            "total_duration_seconds": self.total_duration_seconds,
            "detected_speech_duration_seconds": self.detected_speech_duration_seconds,
            "speech_activity_ratio": self.speech_activity_ratio,
            "speech_activity_percentage": round(self.speech_activity_ratio * 100.0, 1),
            "leading_silence_seconds": self.leading_silence_seconds,
            "trailing_silence_seconds": self.trailing_silence_seconds,
            "internal_gaps": [
                {
                    "start_seconds": g.start_seconds,
                    "end_seconds": g.end_seconds,
                    "duration_seconds": g.duration_seconds,
                }
                for g in self.internal_gaps
            ],
            "internal_gap_count": self.internal_gap_count,
            "total_internal_gap_duration_seconds": self.total_internal_gap_duration_seconds,
            "mean_internal_gap_duration_seconds": self.mean_internal_gap_duration_seconds,
            "transcript_word_count": self.transcript_word_count,
            "words_per_minute_total": self.words_per_minute_total,
            "words_per_minute_speech_only": self.words_per_minute_speech_only,
            "rate_is_transcript_dependent": self.rate_is_transcript_dependent,
            "detector_type": self.detector_type,
            "energy_threshold_db": self.energy_threshold_db,
            "min_gap_duration_seconds": self.min_gap_duration_seconds,
            "sample_rate_hz": self.sample_rate_hz,
        }



def analyze_audio_array(
    audio_array: np.ndarray,
    sample_rate: int = 16000,
    transcript_text: str | None = None,
    word_count: int | None = None,
    energy_threshold_db: float = -40.0,
    min_gap_duration_seconds: float = 0.25,
    frame_duration_ms: float = 25.0,
    hop_duration_ms: float = 10.0,
    min_speech_duration_ms: float = 80.0,
    hangover_ms: float = 150.0,
) -> AcousticAnalysisResult:
    """
    Performs frame-level acoustic analysis on normalized 1D float32 audio.

    Args:
        audio_array: Decoded float32 mono audio samples in [-1.0, 1.0].
        sample_rate: Audio sampling frequency in Hz (default 16000).
        transcript_text: Optional recognised transcript string for WPM calculation.
        word_count: Optional explicit word count overriding text tokenization.
        energy_threshold_db: Energy threshold in dBFS to classify speech.
        min_gap_duration_seconds: Minimum duration for an internal non-speech interval (default 0.25s).
        frame_duration_ms: Duration of RMS analysis frame in ms (default 25.0ms).
        hop_duration_ms: Frame shift step in ms (default 10.0ms).
        min_speech_duration_ms: Minimum duration of speech burst (default 80ms).
        hangover_ms: Window to bridge unvoiced phonetic closures (default 150ms).

    Returns:
        AcousticAnalysisResult with acoustic metrics and optional transcript-derived WPM.
    """
    total_samples = len(audio_array)
    if total_samples == 0 or sample_rate <= 0:
        return AcousticAnalysisResult(
            total_duration_seconds=0.0,
            detected_speech_duration_seconds=0.0,
            speech_activity_ratio=0.0,
            leading_silence_seconds=0.0,
            trailing_silence_seconds=0.0,
            internal_gaps=[],
            internal_gap_count=0,
            total_internal_gap_duration_seconds=0.0,
            mean_internal_gap_duration_seconds=0.0,
            transcript_word_count=None,
            words_per_minute_total=None,
            words_per_minute_speech_only=None,
            rate_is_transcript_dependent=False,
            detector_type="frame_energy_rms",
            energy_threshold_db=energy_threshold_db,
            min_gap_duration_seconds=min_gap_duration_seconds,
            sample_rate_hz=sample_rate,
        )

    total_duration_seconds = round(total_samples / float(sample_rate), 3)

    frame_length = max(1, int(sample_rate * (frame_duration_ms / 1000.0)))
    hop_length = max(1, int(sample_rate * (hop_duration_ms / 1000.0)))

    # Frame-level RMS calculation
    if total_samples < frame_length:
        rms = np.sqrt(np.mean(audio_array.astype(np.float64) ** 2))
        db = 20.0 * np.log10(rms + 1e-7)
        frame_speech = np.array([db >= energy_threshold_db], dtype=bool)
        frame_times = np.array([0.0], dtype=np.float64)
    else:
        num_frames = 1 + (total_samples - frame_length) // hop_length
        # Vectorized or strided frame extraction
        shape = (num_frames, frame_length)
        strides = (audio_array.strides[0] * hop_length, audio_array.strides[0])
        frames = np.lib.stride_tricks.as_strided(audio_array, shape=shape, strides=strides)

        # Mean square per frame
        ms = np.mean(frames.astype(np.float64) ** 2, axis=1)
        rms = np.sqrt(ms)
        db = 20.0 * np.log10(rms + 1e-7)
        frame_speech = db >= energy_threshold_db
        frame_times = (np.arange(num_frames) * hop_length) / float(sample_rate)

    # Convert binary frames into contiguous active intervals
    speech_frames = frame_speech.copy()
    hop_sec = hop_length / float(sample_rate)
    hangover_frames = int(np.ceil((hangover_ms / 1000.0) / hop_sec))
    min_speech_frames = int(np.ceil((min_speech_duration_ms / 1000.0) / hop_sec))

    # Bridge short intra-word closures (hangover)
    if len(speech_frames) > 1:
        # Find false runs between true frames
        diff = np.diff(speech_frames.astype(np.int32))
        starts = np.where(diff == 1)[0] + 1
        ends = np.where(diff == -1)[0] + 1

        if speech_frames[0]:
            starts = np.r_[0, starts]
        if speech_frames[-1]:
            ends = np.r_[ends, len(speech_frames)]

        # Bridge gap between speech segments if under hangover_frames
        for i in range(len(ends) - 1):
            gap_len = starts[i + 1] - ends[i]
            if 0 < gap_len <= hangover_frames:
                speech_frames[ends[i]:starts[i + 1]] = True

    # Find contiguous speech segments after bridging
    diff = np.diff(speech_frames.astype(np.int32))
    seg_starts = np.where(diff == 1)[0] + 1
    seg_ends = np.where(diff == -1)[0] + 1

    if len(speech_frames) > 0 and speech_frames[0]:
        seg_starts = np.r_[0, seg_starts]
    if len(speech_frames) > 0 and speech_frames[-1]:
        seg_ends = np.r_[seg_ends, len(speech_frames)]

    # Filter out bursts shorter than min_speech_frames
    valid_segments: list[tuple[float, float]] = []
    for s_idx, e_idx in zip(seg_starts, seg_ends):
        if (e_idx - s_idx) >= min_speech_frames:
            s_time = round(s_idx * hop_sec, 3)
            e_time = round(min(total_duration_seconds, (e_idx * hop_sec) + (frame_length / float(sample_rate))), 3)
            valid_segments.append((s_time, e_time))

    # Compute peripheral silence vs internal gaps
    if not valid_segments:
        detected_speech_duration = 0.0
        speech_activity_ratio = 0.0
        leading_silence = total_duration_seconds
        trailing_silence = 0.0
        internal_gaps: list[AcousticGap] = []
    else:
        first_speech_start = valid_segments[0][0]
        last_speech_end = valid_segments[-1][1]

        leading_silence = round(first_speech_start, 3)
        trailing_silence = round(max(0.0, total_duration_seconds - last_speech_end), 3)

        detected_speech_duration = round(sum(e - s for s, e in valid_segments), 3)
        speech_activity_ratio = round(
            min(1.0, detected_speech_duration / total_duration_seconds), 4
        ) if total_duration_seconds > 0 else 0.0

        internal_gaps = []
        for i in range(len(valid_segments) - 1):
            gap_start = valid_segments[i][1]
            gap_end = valid_segments[i + 1][0]
            gap_dur = round(max(0.0, gap_end - gap_start), 3)
            if gap_dur >= min_gap_duration_seconds:
                internal_gaps.append(
                    AcousticGap(
                        start_seconds=gap_start,
                        end_seconds=gap_end,
                        duration_seconds=gap_dur,
                    )
                )

    internal_gap_count = len(internal_gaps)
    total_internal_gap_sec = round(sum(g.duration_seconds for g in internal_gaps), 3)
    mean_internal_gap_sec = round(
        total_internal_gap_sec / internal_gap_count, 3
    ) if internal_gap_count > 0 else 0.0

    # Transcript-Derived Speaking Rate (Explicitly Labeled)
    w_count = word_count
    rate_dependent = False
    if w_count is None and transcript_text is not None:
        tokens = re.findall(r"\b[\w'-]+\b", transcript_text)
        w_count = len(tokens)

    if w_count is not None:
        rate_dependent = True
        wpm_total = round(
            w_count / (total_duration_seconds / 60.0), 2
        ) if total_duration_seconds > 0 else 0.0
        wpm_speech = round(
            w_count / (detected_speech_duration / 60.0), 2
        ) if detected_speech_duration > 0 else 0.0
    else:
        wpm_total = None
        wpm_speech = None

    return AcousticAnalysisResult(
        total_duration_seconds=total_duration_seconds,
        detected_speech_duration_seconds=detected_speech_duration,
        speech_activity_ratio=speech_activity_ratio,
        leading_silence_seconds=leading_silence,
        trailing_silence_seconds=trailing_silence,
        internal_gaps=internal_gaps,
        internal_gap_count=internal_gap_count,
        total_internal_gap_duration_seconds=total_internal_gap_sec,
        mean_internal_gap_duration_seconds=mean_internal_gap_sec,
        transcript_word_count=w_count,
        words_per_minute_total=wpm_total,
        words_per_minute_speech_only=wpm_speech,
        rate_is_transcript_dependent=rate_dependent,
        detector_type="frame_energy_rms",
        energy_threshold_db=energy_threshold_db,
        min_gap_duration_seconds=min_gap_duration_seconds,
        sample_rate_hz=sample_rate,
    )


def analyze_audio_recording(
    source: Union[Path, str, BinaryIO, bytes],
    transcript_text: str | None = None,
    word_count: int | None = None,
    energy_threshold_db: float = -40.0,
    min_gap_duration_seconds: float = 0.25,
) -> AcousticAnalysisResult:
    """
    Convenience function that decodes an audio container (WebM, WAV, MP4) and executes
    acoustic analysis.
    """
    decode_result: AudioDecodeResult = decode_audio(source)
    return analyze_audio_array(
        audio_array=decode_result.audio_array,
        sample_rate=decode_result.sample_rate,
        transcript_text=transcript_text,
        word_count=word_count,
        energy_threshold_db=energy_threshold_db,
        min_gap_duration_seconds=min_gap_duration_seconds,
    )


def save_acoustics(session_id: str, take_number: int, result: AcousticAnalysisResult) -> Path:
    """Atomically persists acoustic analysis results to private session storage."""
    session_dir = settings.STORAGE_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    out_file = session_dir / f"acoustics_take_{take_number}.json"
    temp_file = session_dir / f"acoustics_take_{take_number}.json.tmp"
    temp_file.write_text(json.dumps(result.to_dict(), indent=2), encoding="utf-8")
    temp_file.replace(out_file)
    return out_file


def load_acoustics(session_id: str, take_number: int) -> dict | None:
    """Retrieves cached acoustic analysis results if present on disk."""
    target = settings.STORAGE_DIR / session_id / f"acoustics_take_{take_number}.json"
    if target.exists():
        try:
            return json.loads(target.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None

