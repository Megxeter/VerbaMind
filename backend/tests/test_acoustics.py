import numpy as np
import pytest

from backend.services.acoustics import (
    AcousticAnalysisResult,
    AcousticGap,
    analyze_audio_array,
)


def _generate_tone(duration_sec: float, sample_rate: int = 16000, freq: float = 440.0, amplitude: float = 0.5) -> np.ndarray:
    """Helper to generate a sinusoidal audio signal at given amplitude."""
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False, dtype=np.float32)
    return amplitude * np.sin(2 * np.pi * freq * t)


def _generate_silence(duration_sec: float, sample_rate: int = 16000) -> np.ndarray:
    """Helper to generate digital silence."""
    return np.zeros(int(sample_rate * duration_sec), dtype=np.float32)


def test_empty_audio_array_zero_division_safety():
    empty_arr = np.array([], dtype=np.float32)
    res = analyze_audio_array(empty_arr, sample_rate=16000)

    assert isinstance(res, AcousticAnalysisResult)
    assert res.total_duration_seconds == 0.0
    assert res.detected_speech_duration_seconds == 0.0
    assert res.speech_activity_ratio == 0.0
    assert res.leading_silence_seconds == 0.0
    assert res.trailing_silence_seconds == 0.0
    assert res.internal_gaps == []
    assert res.internal_gap_count == 0
    assert res.words_per_minute_total is None
    assert res.words_per_minute_speech_only is None
    assert res.rate_is_transcript_dependent is False


def test_pure_silence_handling():
    # 2 seconds of pure silence
    silence = _generate_silence(2.0, sample_rate=16000)
    res = analyze_audio_array(silence, sample_rate=16000)

    assert res.total_duration_seconds == 2.0
    assert res.detected_speech_duration_seconds == 0.0
    assert res.speech_activity_ratio == 0.0
    assert res.leading_silence_seconds == 2.0
    assert res.trailing_silence_seconds == 0.0
    assert res.internal_gaps == []
    assert res.internal_gap_count == 0


def test_continuous_speech_no_internal_gaps():
    # 2 seconds of active tone
    tone = _generate_tone(2.0, sample_rate=16000, amplitude=0.4)
    res = analyze_audio_array(tone, sample_rate=16000)

    assert pytest.approx(res.total_duration_seconds, abs=0.05) == 2.0
    assert pytest.approx(res.detected_speech_duration_seconds, abs=0.05) == 2.0
    assert pytest.approx(res.speech_activity_ratio, abs=0.05) == 1.0
    assert res.leading_silence_seconds < 0.05
    assert res.trailing_silence_seconds < 0.05
    assert res.internal_gaps == []
    assert res.internal_gap_count == 0


def test_leading_and_trailing_silence_separated_from_internal_gaps():
    # 0.5s silence + 1.2s tone + 0.8s silence
    part1 = _generate_silence(0.5, 16000)
    part2 = _generate_tone(1.2, 16000, amplitude=0.4)
    part3 = _generate_silence(0.8, 16000)
    audio = np.concatenate([part1, part2, part3])

    res = analyze_audio_array(audio, sample_rate=16000)

    assert pytest.approx(res.total_duration_seconds, abs=0.05) == 2.5
    assert pytest.approx(res.leading_silence_seconds, abs=0.08) == 0.5
    assert pytest.approx(res.trailing_silence_seconds, abs=0.08) == 0.8
    assert pytest.approx(res.detected_speech_duration_seconds, abs=0.08) == 1.2
    # Zero internal gaps, because silence was exclusively peripheral
    assert res.internal_gaps == []
    assert res.internal_gap_count == 0


def test_internal_gap_detection_between_speech_segments():
    # 0.2s silence + 1.0s tone + 0.6s gap (silence > 0.25s) + 1.0s tone + 0.3s silence
    lead = _generate_silence(0.2, 16000)
    tone1 = _generate_tone(1.0, 16000, amplitude=0.4)
    gap = _generate_silence(0.6, 16000)
    tone2 = _generate_tone(1.0, 16000, amplitude=0.4)
    trail = _generate_silence(0.3, 16000)
    audio = np.concatenate([lead, tone1, gap, tone2, trail])

    res = analyze_audio_array(audio, sample_rate=16000, min_gap_duration_seconds=0.25)

    assert pytest.approx(res.total_duration_seconds, abs=0.05) == 3.1
    assert pytest.approx(res.leading_silence_seconds, abs=0.08) == 0.2
    assert pytest.approx(res.trailing_silence_seconds, abs=0.08) == 0.3
    assert res.internal_gap_count == 1
    assert len(res.internal_gaps) == 1

    gap_meas = res.internal_gaps[0]
    assert isinstance(gap_meas, AcousticGap)
    assert pytest.approx(gap_meas.duration_seconds, abs=0.1) == 0.6
    assert pytest.approx(gap_meas.start_seconds, abs=0.1) == 1.2  # lead (0.2) + tone1 (1.0)
    assert pytest.approx(gap_meas.end_seconds, abs=0.1) == 1.8
    assert pytest.approx(res.total_internal_gap_duration_seconds, abs=0.1) == 0.6
    assert pytest.approx(res.mean_internal_gap_duration_seconds, abs=0.1) == 0.6


def test_micro_pause_under_threshold_not_counted_as_internal_gap():
    # Gap of 0.10s is under 0.25s threshold (natural phonetic stop/closure)
    tone1 = _generate_tone(0.8, 16000, amplitude=0.4)
    micro_gap = _generate_silence(0.10, 16000)
    tone2 = _generate_tone(0.8, 16000, amplitude=0.4)
    audio = np.concatenate([tone1, micro_gap, tone2])

    res = analyze_audio_array(audio, sample_rate=16000, min_gap_duration_seconds=0.25)

    # The 100ms micro-gap should not be reported as an acoustic pause/gap
    assert res.internal_gap_count == 0
    assert res.internal_gaps == []


def test_transcript_derived_speaking_rate_calculation():
    # 2.0s audio with 1.0s speech and transcript of 4 words
    lead = _generate_silence(0.5, 16000)
    tone = _generate_tone(1.0, 16000, amplitude=0.4)
    trail = _generate_silence(0.5, 16000)
    audio = np.concatenate([lead, tone, trail])

    res = analyze_audio_array(audio, sample_rate=16000, transcript_text="quick brown fox jumps")

    assert res.transcript_word_count == 4
    assert res.rate_is_transcript_dependent is True
    # total duration is 2.0s = 2.0/60 min -> 4 / (2/60) = 120 WPM
    assert pytest.approx(res.words_per_minute_total, abs=5.0) == 120.0
    # speech duration is 1.0s = 1.0/60 min -> 4 / (1/60) = 240 WPM
    assert pytest.approx(res.words_per_minute_speech_only, abs=15.0) == 240.0


def test_explicit_word_count_precedence():
    tone = _generate_tone(1.0, 16000, amplitude=0.4)
    res = analyze_audio_array(tone, sample_rate=16000, word_count=10)

    assert res.transcript_word_count == 10
    assert res.rate_is_transcript_dependent is True
    assert pytest.approx(res.words_per_minute_total, abs=10.0) == 600.0


def test_short_clip_stability():
    # Very short audio snippet (50ms)
    short_audio = _generate_tone(0.05, 16000, amplitude=0.4)
    res = analyze_audio_array(short_audio, sample_rate=16000)
    assert res.total_duration_seconds == 0.05


def test_invariants_no_fluency_or_pronunciation_score():
    tone = _generate_tone(1.0, 16000, amplitude=0.4)
    res = analyze_audio_array(tone, sample_rate=16000)

    # Scientific Invariant: Fluency and pronunciation scores must NOT be present
    assert not hasattr(res, "fluency_score")
    assert not hasattr(res, "pronunciation_score")
    assert not hasattr(res, "grade")


def test_analyze_audio_recording_integration(tmp_path):
    import wave
    from backend.services.acoustics import analyze_audio_recording

    wav_file = tmp_path / "test_sample.wav"
    sample_rate = 16000
    # 0.5s tone + 0.5s silence
    tone = _generate_tone(0.5, sample_rate, amplitude=0.5)
    silence = _generate_silence(0.5, sample_rate)
    samples = np.concatenate([tone, silence])
    pcm16 = (samples * 32767).astype(np.int16)

    with wave.open(str(wav_file), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16.tobytes())

    res = analyze_audio_recording(wav_file, transcript_text="test words")
    assert pytest.approx(res.total_duration_seconds, abs=0.05) == 1.0
    assert pytest.approx(res.detected_speech_duration_seconds, abs=0.08) == 0.5
    assert pytest.approx(res.trailing_silence_seconds, abs=0.08) == 0.5
    assert res.transcript_word_count == 2
    assert res.rate_is_transcript_dependent is True


def test_analyze_audio_recording_missing_file_raises():
    from backend.services.acoustics import analyze_audio_recording
    from backend.services.audio_decoder import AudioDecodingError

    with pytest.raises(AudioDecodingError):
        analyze_audio_recording("non_existent_audio_file.webm")

