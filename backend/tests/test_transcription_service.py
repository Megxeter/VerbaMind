import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from backend.services.transcription import (
    ModelNotFoundError,
    SegmentTiming,
    TranscriptionError,
    TranscriptionResult,
    TranscriptionService,
    WordTiming,
)


def test_missing_model_directory_raises_error(tmp_path: Path):
    non_existent = tmp_path / "non_existent_model_dir"
    service = TranscriptionService(model_dir=non_existent)
    dummy_audio = np.zeros(16000, dtype=np.float32)

    with pytest.raises(ModelNotFoundError, match="not found"):
        service.transcribe_audio_array(dummy_audio, duration_seconds=1.0)


def test_missing_model_bin_raises_error(tmp_path: Path):
    model_dir = tmp_path / "incomplete_model"
    model_dir.mkdir(parents=True)
    # config.json present but model.bin missing
    (model_dir / "config.json").write_text("{}", encoding="utf-8")

    service = TranscriptionService(model_dir=model_dir)
    dummy_audio = np.zeros(16000, dtype=np.float32)

    with pytest.raises(ModelNotFoundError, match="model.bin not found"):
        service.transcribe_audio_array(dummy_audio, duration_seconds=1.0)


def test_empty_audio_returns_empty_transcript():
    service = TranscriptionService()
    # Empty array
    empty_audio = np.array([], dtype=np.float32)
    result = service.transcribe_audio_array(empty_audio, duration_seconds=0.0)

    assert isinstance(result, TranscriptionResult)
    assert result.text == ""
    assert result.segments == []
    assert result.word_count == 0
    assert result.duration_seconds == 0.0


def test_transcription_mocked_success(tmp_path: Path):
    model_dir = tmp_path / "fake_model"
    model_dir.mkdir()
    (model_dir / "model.bin").write_bytes(b"dummy")

    mock_whisper = MagicMock()
    mock_word_1 = SimpleNamespace(word=" Distributed", start=0.2, end=0.8, probability=0.95)
    mock_word_2 = SimpleNamespace(word=" caching", start=0.85, end=1.4, probability=0.92)
    mock_segment = SimpleNamespace(
        id=1,
        seek=0,
        start=0.2,
        end=1.4,
        text="Distributed caching",
        words=[mock_word_1, mock_word_2],
    )
    mock_info = SimpleNamespace(language="en", language_probability=0.99)

    mock_whisper.transcribe.return_value = ([mock_segment], mock_info)

    service = TranscriptionService(model_dir=model_dir)
    with patch("faster_whisper.WhisperModel", return_value=mock_whisper):
        audio_arr = np.zeros(32000, dtype=np.float32)
        result = service.transcribe_audio_array(audio_arr, duration_seconds=2.0)

    assert result.text == "Distributed caching"
    assert len(result.segments) == 1
    assert result.word_count == 2
    assert result.language == "en"
    assert result.duration_seconds == 2.0
    assert len(result.segments[0].words) == 2

    # Invariant: Tokens must have 'probability', NEVER 'score' or 'fluency_score'
    w1 = result.segments[0].words[0]
    assert w1.word == "Distributed"
    assert w1.start == 0.2
    assert w1.end == 0.8
    assert w1.probability == 0.95
    assert not hasattr(w1, "score")
    assert not hasattr(w1, "fluency_score")


def test_initial_prompt_invariant_preserved(tmp_path: Path):
    model_dir = tmp_path / "fake_model"
    model_dir.mkdir()
    (model_dir / "model.bin").write_bytes(b"dummy")

    mock_whisper = MagicMock()
    mock_whisper.transcribe.return_value = ([], SimpleNamespace(language="en", language_probability=1.0))

    service = TranscriptionService(model_dir=model_dir)
    with patch("faster_whisper.WhisperModel", return_value=mock_whisper):
        audio_arr = np.zeros(16000, dtype=np.float32)
        service.transcribe_audio_array(audio_arr, duration_seconds=1.0)

    # Invariant check: initial_prompt must explicitly be None
    _, kwargs = mock_whisper.transcribe.call_args
    assert kwargs.get("initial_prompt") is None


def test_inference_failure_raises_transcription_error(tmp_path: Path):
    model_dir = tmp_path / "fake_model"
    model_dir.mkdir()
    (model_dir / "model.bin").write_bytes(b"dummy")

    mock_whisper = MagicMock()
    mock_whisper.transcribe.side_effect = RuntimeError("CTranslate2 compute error")

    service = TranscriptionService(model_dir=model_dir)
    with patch("faster_whisper.WhisperModel", return_value=mock_whisper):
        audio_arr = np.zeros(16000, dtype=np.float32)
        with pytest.raises(TranscriptionError, match="Acoustic transcription inference failed"):
            service.transcribe_audio_array(audio_arr, duration_seconds=1.0)


def test_save_transcript_atomic(tmp_path: Path):
    service = TranscriptionService()
    result = TranscriptionResult(
        text="Sample transcript",
        segments=[],
        language="en",
        language_probability=1.0,
        duration_seconds=5.0,
        processing_time_seconds=0.5,
        model_name="base.en",
        device="cpu",
        compute_type="int8",
        word_count=2,
    )

    out_file = service.save_transcript(
        session_id="sess_test_123",
        take_number=1,
        result=result,
        storage_dir=tmp_path,
    )

    assert out_file.exists()
    assert out_file.name == "transcript_take_1.json"
    saved_data = json.loads(out_file.read_text(encoding="utf-8"))
    assert saved_data["text"] == "Sample transcript"
    assert saved_data["duration_seconds"] == 5.0
    assert saved_data["model_name"] == "base.en"
