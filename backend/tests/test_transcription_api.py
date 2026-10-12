import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.testclient import TestClient

from backend.core.config import settings
from backend.main import app
from backend.services.transcription import (
    SegmentTiming,
    TranscriptionResult,
    WordTiming,
)
from backend.services.transcription_worker import (
    TranscriptionJob,
    TranscriptionWorkerManager,
    get_worker_manager,
)


@pytest.fixture
def client():
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


@pytest.fixture
def mock_transcription_result() -> TranscriptionResult:
    return TranscriptionResult(
        text="Hello world distributed caching test.",
        segments=[
            SegmentTiming(
                id=1,
                seek=0,
                start=0.5,
                end=2.5,
                text="Hello world distributed caching test.",
                words=[
                    WordTiming(word="Hello", start=0.5, end=0.9, probability=0.98),
                    WordTiming(word="world", start=0.95, end=1.3, probability=0.95),
                    WordTiming(word="distributed", start=1.35, end=1.9, probability=0.92),
                    WordTiming(word="caching", start=1.95, end=2.3, probability=0.88),
                    WordTiming(word="test.", start=2.35, end=2.5, probability=0.91),
                ],
            )
        ],
        language="en",
        language_probability=1.0,
        duration_seconds=3.0,
        processing_time_seconds=0.25,
        model_name="base.en",
        device="cpu",
        compute_type="int8",
        word_count=5,
    )


def test_transcribe_missing_recording_returns_404(client: TestClient):
    response = client.post("/api/sessions/sess_missing_rec/recordings/1/transcribe")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "RECORDING_NOT_FOUND"


def test_transcribe_path_traversal_session_id_returns_400(client: TestClient):
    response = client.post("/api/sessions/sess..traversal/recordings/1/transcribe")
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_SESSION_ID"


def test_transcribe_invalid_take_number_returns_422(client: TestClient):
    response = client.post("/api/sessions/sess_valid/recordings/0/transcribe")
    assert response.status_code == 422


def test_transcribe_development_mode_enforced(client: TestClient):
    with patch.object(settings, "ENVIRONMENT", "production"):
        response = client.post("/api/sessions/sess_valid/recordings/1/transcribe")
        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == "DEVELOPMENT_ONLY_ENDPOINT"


def test_transcribe_loopback_restriction():
    with TestClient(app, client=("198.51.100.1", 54321)) as remote_client:
        response = remote_client.post("/api/sessions/sess_valid/recordings/1/transcribe")
        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == "FORBIDDEN_ORIGIN"


def test_get_transcript_not_found_returns_404(client: TestClient):
    response = client.get("/api/sessions/sess_no_job/recordings/1/transcript")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "TRANSCRIPT_NOT_FOUND"


def test_transcribe_and_get_lifecycle(
    client: TestClient,
    tmp_path: Path,
    mock_transcription_result: TranscriptionResult,
):
    # Setup dummy session recording file
    session_id = "sess_api_lifecycle"
    session_dir = tmp_path / session_id
    session_dir.mkdir(parents=True)
    audio_file = session_dir / "take_1.webm"
    audio_file.write_bytes(b"\x1a\x45\xdf\xa3dummy-audio-bytes")

    with patch.object(settings, "STORAGE_DIR", tmp_path):
        mock_service = MagicMock()
        mock_service.transcribe_file.return_value = mock_transcription_result
        mock_service.save_transcript.side_effect = lambda s, t, r: (tmp_path / s / f"transcript_take_{t}.json")

        worker = TranscriptionWorkerManager(service=mock_service, max_queue_size=2)
        app.dependency_overrides[get_worker_manager] = lambda: worker

        # 1. Start transcription
        post_res = client.post(f"/api/sessions/{session_id}/recordings/1/transcribe")
        assert post_res.status_code in (200, 202)
        post_data = post_res.json()
        assert post_data["session_id"] == session_id
        assert post_data["take_number"] == 1
        assert post_data["status"] in ("queued", "processing", "completed")

        # 2. Duplicate submission returns existing job without error
        dup_res = client.post(f"/api/sessions/{session_id}/recordings/1/transcribe")
        assert dup_res.status_code in (200, 202)
        dup_data = dup_res.json()
        assert dup_data["job_id"] == post_data["job_id"]

        # 3. Simulate completion in memory
        job = worker.get_job(session_id, 1)
        assert job is not None
        job.status = "completed"
        job.transcript = mock_transcription_result

        # 4. GET transcript endpoint
        get_res = client.get(f"/api/sessions/{session_id}/recordings/1/transcript")
        assert get_res.status_code == 200
        get_data = get_res.json()
        assert get_data["status"] == "completed"
        assert get_data["transcript"]["text"] == "Hello world distributed caching test."
        assert len(get_data["transcript"]["segments"]) == 1
        assert len(get_data["transcript"]["segments"][0]["words"]) == 5

        # Invariant: Zero filesystem path exposure
        payload_str = str(get_data)
        assert str(tmp_path) not in payload_str


def test_transcription_queue_full_returns_503(client: TestClient, tmp_path: Path):
    session_id = "sess_queue_test"
    session_dir = tmp_path / session_id
    session_dir.mkdir(parents=True)
    audio_file = session_dir / "take_1.webm"
    audio_file.write_bytes(b"\x1a\x45\xdf\xa3dummy")

    with patch.object(settings, "STORAGE_DIR", tmp_path):
        mock_worker = MagicMock()
        mock_worker.start = AsyncMock()
        from backend.services.transcription_worker import TranscriptionQueueFullError
        mock_worker.submit_job.side_effect = TranscriptionQueueFullError("Queue capacity reached")

        app.dependency_overrides[get_worker_manager] = lambda: mock_worker

        response = client.post(f"/api/sessions/{session_id}/recordings/1/transcribe")
        assert response.status_code == 503
        data = response.json()
        assert data["error"]["code"] == "TRANSCRIPTION_QUEUE_FULL"
