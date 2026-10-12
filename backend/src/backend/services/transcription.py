import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Union

import numpy as np
from pydantic import BaseModel, Field

from backend.core.config import settings
from backend.services.audio_decoder import decode_audio

logger = logging.getLogger("verbamind.transcription")


class ModelNotFoundError(Exception):
    """Raised when the specified offline Whisper model weights directory is missing."""
    pass


class TranscriptionError(Exception):
    """Raised when acoustic inference fails."""
    pass


class WordTiming(BaseModel):
    """
    Word-level alignment details extracted from acoustic attention matrices.
    IMPORTANT PROJECT INVARIANT: 'probability' is an acoustic model token confidence,
    NEVER a pronunciation or fluency score.
    """
    word: str = Field(..., description="Recognized word token text")
    start: float = Field(..., description="Start timestamp relative to recording onset (seconds)")
    end: float = Field(..., description="End timestamp relative to recording onset (seconds)")
    probability: float = Field(
        ...,
        description="Acoustic decoder token probability [0.0 - 1.0]. Not a fluency metric.",
    )


class SegmentTiming(BaseModel):
    """Sequential phrase/sentence segment with phrase bounds and word alignments."""
    id: int
    seek: int
    start: float
    end: float
    text: str
    words: list[WordTiming] = Field(default_factory=list)


class TranscriptionResult(BaseModel):
    """Structured transcription output with timestamps, performance timings, and provenance."""
    text: str = Field(..., description="Full consolidated transcript text")
    segments: list[SegmentTiming] = Field(default_factory=list)
    language: str = Field("en", description="Detected language code")
    language_probability: float = Field(1.0, description="Language identification confidence")
    duration_seconds: float = Field(..., description="Decoded audio duration in seconds")
    processing_time_seconds: float = Field(..., description="Wall-clock inference elapsed time")
    model_name: str = Field(..., description="Identifier of the pretrained model used")
    device: str = Field(..., description="Compute device (e.g. cpu, cuda)")
    compute_type: str = Field(..., description="Quantization precision (e.g. int8, float16)")
    word_count: int = Field(0, description="Total recognized words")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TranscriptionService:
    """
    Reusable offline speech recognition service powered by faster-whisper (CTranslate2).
    Operates strictly on local files without remote network fallbacks or external APIs.
    """

    def __init__(
        self,
        model_dir: Optional[Path] = None,
        device: Optional[str] = None,
        compute_type: Optional[str] = None,
        cpu_threads: Optional[int] = None,
    ):
        self.model_dir = model_dir or settings.WHISPER_MODEL_DIR
        self.device = device or settings.WHISPER_DEVICE
        self.compute_type = compute_type or settings.WHISPER_COMPUTE_TYPE
        self.cpu_threads = cpu_threads or settings.WHISPER_CPU_THREADS
        self._model = None

    def _ensure_model_loaded(self):
        """Loads WhisperModel from the local filesystem directory."""
        if self._model is not None:
            return self._model

        if not self.model_dir.exists():
            raise ModelNotFoundError(
                f"Offline Whisper model weights directory not found at: {self.model_dir}. "
                "Download model weights to this directory before initiating transcription."
            )

        # Check required model files
        model_bin = self.model_dir / "model.bin"
        if not model_bin.exists():
            raise ModelNotFoundError(
                f"model.bin not found in {self.model_dir}. Incomplete model cache."
            )

        try:
            from faster_whisper import WhisperModel

            logger.info(
                "Loading offline Whisper model from %s on device=%s, compute_type=%s...",
                self.model_dir,
                self.device,
                self.compute_type,
            )
            self._model = WhisperModel(
                model_size_or_path=str(self.model_dir),
                device=self.device,
                compute_type=self.compute_type,
                cpu_threads=self.cpu_threads,
                local_files_only=True,  # Crucial: Enforce zero network calls
            )
            return self._model
        except Exception as exc:
            raise TranscriptionError(f"Failed to instantiate WhisperModel: {exc}") from exc

    def transcribe_audio_array(
        self,
        audio_array: np.ndarray,
        duration_seconds: float,
        beam_size: int = settings.WHISPER_BEAM_SIZE,
    ) -> TranscriptionResult:
        """
        Transcribes a 16kHz float32 audio numpy array.

        IMPORTANT INVARIANTS:
        - initial_prompt is NEVER provided (pure unbiased speech recognition).
        - Empty audio produces empty transcripts without hallucination.
        """
        model = self._ensure_model_loaded()

        # Handle degenerate/silent zero-length audio gracefully
        if len(audio_array) == 0:
            return TranscriptionResult(
                text="",
                segments=[],
                language="en",
                language_probability=1.0,
                duration_seconds=0.0,
                processing_time_seconds=0.0,
                model_name=settings.WHISPER_MODEL_NAME,
                device=self.device,
                compute_type=self.compute_type,
                word_count=0,
            )

        t0 = time.perf_counter()

        try:
            segments_gen, info = model.transcribe(
                audio_array,
                beam_size=beam_size,
                word_timestamps=True,
                language="en",
                initial_prompt=None,  # Invariant: Never bias recognition with reference passage
            )

            segments: list[SegmentTiming] = []
            words_total = 0

            for seg in segments_gen:
                words: list[WordTiming] = []
                if seg.words:
                    for w in seg.words:
                        cleaned_word = w.word.strip()
                        if cleaned_word:
                            words.append(
                                WordTiming(
                                    word=cleaned_word,
                                    start=round(w.start, 3),
                                    end=round(w.end, 3),
                                    probability=round(w.probability, 3),
                                )
                            )
                words_total += len(words)
                segments.append(
                    SegmentTiming(
                        id=seg.id,
                        seek=seg.seek,
                        start=round(seg.start, 3),
                        end=round(seg.end, 3),
                        text=seg.text.strip(),
                        words=words,
                    )
                )

            elapsed = round(time.perf_counter() - t0, 3)
            full_text = " ".join(s.text for s in segments if s.text).strip()

            return TranscriptionResult(
                text=full_text,
                segments=segments,
                language=info.language or "en",
                language_probability=round(info.language_probability, 3) if info.language_probability else 1.0,
                duration_seconds=duration_seconds,
                processing_time_seconds=elapsed,
                model_name=settings.WHISPER_MODEL_NAME,
                device=self.device,
                compute_type=self.compute_type,
                word_count=words_total,
            )

        except Exception as exc:
            raise TranscriptionError(f"Acoustic transcription inference failed: {exc}") from exc

    def transcribe_file(
        self,
        audio_path: Union[str, Path],
        max_duration_sec: float = settings.MAX_RECORDING_SECONDS,
    ) -> TranscriptionResult:
        """
        Decodes an audio file locally using PyAV and performs offline transcription.
        """
        decoded = decode_audio(
            source=audio_path,
            max_duration_sec=max_duration_sec,
            target_sample_rate=settings.TARGET_SAMPLE_RATE,
        )

        return self.transcribe_audio_array(
            audio_array=decoded.audio_array,
            duration_seconds=decoded.duration_seconds,
        )

    def save_transcript(
        self,
        session_id: str,
        take_number: int,
        result: TranscriptionResult,
        storage_dir: Optional[Path] = None,
    ) -> Path:
        """
        Persists structured transcript JSON to private storage alongside recordings.
        Uses atomic file replacement to prevent corrupted or partial writes.
        """
        base_dir = storage_dir or settings.STORAGE_DIR
        session_dir = base_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        target_file = session_dir / f"transcript_take_{take_number}.json"
        temp_file = session_dir / f"transcript_take_{take_number}.json.tmp"

        payload = result.model_dump_json(indent=2)
        temp_file.write_text(payload, encoding="utf-8")
        os.replace(temp_file, target_file)

        logger.info(
            "Persisted transcript for session '%s' take %d to %s",
            session_id,
            take_number,
            target_file,
        )
        return target_file


# Global default service provider
_transcription_service: Optional[TranscriptionService] = None


def get_transcription_service() -> TranscriptionService:
    """Dependency provider for TranscriptionService."""
    global _transcription_service
    if _transcription_service is None:
        _transcription_service = TranscriptionService()
    return _transcription_service
