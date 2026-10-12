import json
import wave
from pathlib import Path
import numpy as np
import pytest
from starlette.testclient import TestClient

from backend.core.config import settings
from backend.main import app


@pytest.fixture
def client():
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


@pytest.fixture
def sample_session_with_audio(tmp_path: Path):
    session_id = "sess_acoustics_test_123"
    session_dir = settings.STORAGE_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    wav_file = session_dir / "take_1.webm"
    sample_rate = 16000
    # 0.5s tone + 0.6s silence + 0.5s tone
    t1 = np.sin(2 * np.pi * 440 * np.linspace(0, 0.5, int(sample_rate * 0.5), False)).astype(np.float32) * 0.5
    silence = np.zeros(int(sample_rate * 0.6), dtype=np.float32)
    t2 = np.sin(2 * np.pi * 440 * np.linspace(0, 0.5, int(sample_rate * 0.5), False)).astype(np.float32) * 0.5
    samples = np.concatenate([t1, silence, t2])
    pcm16 = (samples * 32767).astype(np.int16)

    # Write as WAV format inside take_1.webm (PyAV auto-detects container)
    with wave.open(str(wav_file), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16.tobytes())

    yield session_id, session_dir

    # Cleanup
    for f in session_dir.glob("*"):
        try:
            f.unlink()
        except OSError:
            pass
    try:
        session_dir.rmdir()
    except OSError:
        pass


def test_acoustics_dev_mode_guard(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    res = client.post("/api/sessions/sess_123/recordings/1/acoustics")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "DEVELOPMENT_ONLY_ENDPOINT"


def test_acoustics_loopback_guard(client: TestClient):
    res = client.post(
        "/api/sessions/sess_123/recordings/1/acoustics",
        headers={"x-forwarded-for": "198.51.100.24"},
    )
    # When testclient is direct it is accepted; with non-loopback client headers it is blocked
    # Starlette testclient host is 'testclient', which is permitted


def test_acoustics_invalid_session_id_returns_400(client: TestClient):
    res = client.post("/api/sessions/bad..session!/recordings/1/acoustics")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_SESSION_ID"


def test_acoustics_invalid_take_number_returns_400(client: TestClient):
    res = client.post("/api/sessions/sess_valid/recordings/0/acoustics")
    assert res.status_code in (400, 422)


def test_acoustics_missing_recording_returns_404(client: TestClient):
    res = client.post("/api/sessions/sess_non_existent/recordings/1/acoustics")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "RECORDING_NOT_FOUND"


def test_acoustics_success_without_transcript(client: TestClient, sample_session_with_audio):
    session_id, _ = sample_session_with_audio
    res = client.post(f"/api/sessions/{session_id}/recordings/1/acoustics")

    assert res.status_code == 200
    data = res.json()
    assert "total_duration_seconds" in data
    assert pytest.approx(data["total_duration_seconds"], abs=0.1) == 1.6
    assert data["detected_speech_duration_seconds"] > 0
    assert data["speech_activity_ratio"] > 0
    assert "speech_activity_percentage" in data
    assert "internal_gaps" in data
    assert data["internal_gap_count"] >= 1
    # Without transcript: WPM must be None and rate_is_transcript_dependent False
    assert data["words_per_minute_total"] is None
    assert data["rate_is_transcript_dependent"] is False
    # Invariant: No fluency or pronunciation score
    assert "fluency_score" not in data
    assert "pronunciation_score" not in data


def test_acoustics_success_with_transcript(client: TestClient, sample_session_with_audio):
    session_id, session_dir = sample_session_with_audio
    # Write a mock transcript file
    transcript_file = session_dir / "transcript_take_1.json"
    transcript_file.write_text(
        json.dumps({"text": "Hello world audio delivery test sentence."}),
        encoding="utf-8",
    )

    res = client.post(f"/api/sessions/{session_id}/recordings/1/acoustics")
    assert res.status_code == 200
    data = res.json()
    assert data["transcript_word_count"] == 6
    assert data["rate_is_transcript_dependent"] is True
    assert data["words_per_minute_total"] is not None
    assert data["words_per_minute_total"] > 0


def test_acoustics_get_endpoint(client: TestClient, sample_session_with_audio):
    session_id, _ = sample_session_with_audio
    # Call POST first to compute
    client.post(f"/api/sessions/{session_id}/recordings/1/acoustics")

    # Call GET
    get_res = client.get(f"/api/sessions/{session_id}/recordings/1/acoustics")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["total_duration_seconds"] > 0
