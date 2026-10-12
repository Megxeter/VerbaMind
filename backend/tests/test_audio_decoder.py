import io
import wave
from pathlib import Path

import numpy as np
import pytest

from backend.services.audio_decoder import (
    AudioDecodeResult,
    AudioDecodingError,
    AudioDurationExceededError,
    decode_audio,
)


def create_pcm_wav_bytes(duration_sec: float = 1.0, sample_rate: int = 44100, channels: int = 2) -> bytes:
    """Helper to generate in-memory valid PCM WAV audio bytes."""
    num_samples = int(duration_sec * sample_rate)
    # Generate 440 Hz sine wave
    t = np.linspace(0, duration_sec, num_samples, endpoint=False)
    waveform = (np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)

    if channels == 2:
        interleaved = np.empty((num_samples * 2,), dtype=np.int16)
        interleaved[0::2] = waveform
        interleaved[1::2] = waveform
        raw_samples = interleaved.tobytes()
    else:
        raw_samples = waveform.tobytes()

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(raw_samples)
    return buf.getvalue()


def test_decode_valid_wav_bytes():
    wav_bytes = create_pcm_wav_bytes(duration_sec=1.5, sample_rate=44100, channels=2)
    result = decode_audio(source=wav_bytes, max_duration_sec=10.0, target_sample_rate=16000)

    assert isinstance(result, AudioDecodeResult)
    assert result.sample_rate == 16000
    assert result.original_sample_rate == 44100
    assert result.original_channels == 2
    assert result.codec.startswith("pcm")
    assert pytest.approx(result.duration_seconds, abs=0.05) == 1.5
    assert isinstance(result.audio_array, np.ndarray)
    assert result.audio_array.dtype == np.float32
    # Verify mono 1D array
    assert result.audio_array.ndim == 1
    # Verify normalized bounds
    assert np.max(result.audio_array) <= 1.0
    assert np.min(result.audio_array) >= -1.0


def test_decode_empty_bytes_rejected():
    with pytest.raises(AudioDecodingError, match="empty"):
        decode_audio(b"")


def test_decode_corrupt_bytes_rejected():
    garbage = b"RIFF\x00\x00\x00\x00NOT_AUDIO_GARBAGE_PAYLOAD"
    with pytest.raises(AudioDecodingError):
        decode_audio(garbage)


def test_decode_nonexistent_file_rejected(tmp_path: Path):
    missing_file = tmp_path / "non_existent.webm"
    with pytest.raises(AudioDecodingError, match="does not exist"):
        decode_audio(missing_file)


def test_decode_duration_limit_exceeded_rejected():
    # Generate 5 seconds of audio, but configure max_duration_sec to 2.0
    long_wav = create_pcm_wav_bytes(duration_sec=5.0, sample_rate=16000, channels=1)
    with pytest.raises(AudioDurationExceededError, match="exceeds maximum duration limit"):
        decode_audio(source=long_wav, max_duration_sec=2.0, target_sample_rate=16000)
