from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.config import settings
from backend.services.storage import LocalStorageService, get_storage_service

# Valid binary headers for authorized containers
VALID_WEBM_HEADER = b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\x82\x84webm" + b"\x00" * 32
VALID_WAV_HEADER = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00" + b"\x00" * 32


@pytest.fixture
def client(tmp_path: Path):
    test_storage = LocalStorageService(storage_dir=tmp_path / "recordings_test")
    app.dependency_overrides[get_storage_service] = lambda: test_storage
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


def test_valid_webm_upload_success(client: TestClient):
    response = client.post(
        "/api/sessions/session_abc123/recording",
        data={"exercise_id": "tech-distributed-caching", "take_number": 1},
        files={"audio": ("recording.webm", VALID_WEBM_HEADER, "audio/webm")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["session_id"] == "session_abc123"
    assert data["exercise_id"] == "tech-distributed-caching"
    assert data["take_number"] == 1
    assert data["file_id"] == "take_1.webm"
    assert data["mime_type"] == "audio/webm"
    assert data["byte_size"] == len(VALID_WEBM_HEADER)
    assert data["status"] == "uploaded"
    assert "created_at" in data

    # Verify no filesystem absolute path is leaked
    assert "storage" not in response.text
    assert "recordings_test" not in response.text


def test_valid_wav_upload_success(client: TestClient):
    response = client.post(
        "/api/sessions/session_wav999/recording",
        data={"exercise_id": "hr-behavioral-teamwork", "take_number": 2},
        files={"audio": ("recording.wav", VALID_WAV_HEADER, "audio/wav")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["session_id"] == "session_wav999"
    assert data["file_id"] == "take_2.wav"
    assert data["mime_type"] == "audio/wav"


def test_empty_audio_rejected(client: TestClient):
    response = client.post(
        "/api/sessions/session_empty/recording",
        data={"exercise_id": "tech-distributed-caching", "take_number": 1},
        files={"audio": ("empty.webm", b"", "audio/webm")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "EMPTY_AUDIO_PAYLOAD"


def test_oversized_audio_rejected(client: TestClient):
    huge_payload = VALID_WEBM_HEADER + b"x" * (settings.MAX_AUDIO_BYTES + 10)
    response = client.post(
        "/api/sessions/session_huge/recording",
        data={"exercise_id": "tech-distributed-caching", "take_number": 1},
        files={"audio": ("huge.webm", huge_payload, "audio/webm")},
    )
    assert response.status_code == 413
    data = response.json()
    assert data["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_invalid_container_magic_bytes_rejected(client: TestClient):
    fake_audio = b"This is a text file claiming to be audio/webm."
    response = client.post(
        "/api/sessions/session_fake/recording",
        data={"exercise_id": "tech-distributed-caching", "take_number": 1},
        files={"audio": ("take_1.webm", fake_audio, "audio/webm")},
    )
    assert response.status_code == 415
    data = response.json()
    assert data["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_path_traversal_session_id_rejected(client: TestClient):
    response = client.post(
        "/api/sessions/session..traversal/recording",
        data={"exercise_id": "tech-distributed-caching", "take_number": 1},
        files={"audio": ("take_1.webm", VALID_WEBM_HEADER, "audio/webm")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_SESSION_ID"


def test_invalid_exercise_id_rejected(client: TestClient):
    response = client.post(
        "/api/sessions/session_valid/recording",
        data={"exercise_id": "invalid/exercise/name", "take_number": 1},
        files={"audio": ("take_1.webm", VALID_WEBM_HEADER, "audio/webm")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_EXERCISE_ID"


def test_invalid_take_number_rejected(client: TestClient):
    response = client.post(
        "/api/sessions/session_valid/recording",
        data={"exercise_id": "tech-caching", "take_number": 0},
        files={"audio": ("take_1.webm", VALID_WEBM_HEADER, "audio/webm")},
    )
    assert response.status_code == 422


def test_duplicate_submission_rejected(client: TestClient):
    # First upload succeeds
    first_res = client.post(
        "/api/sessions/session_dup/recording",
        data={"exercise_id": "tech-caching", "take_number": 1},
        files={"audio": ("take_1.webm", VALID_WEBM_HEADER, "audio/webm")},
    )
    assert first_res.status_code == 201

    # Second upload with identical session_id and take_number must return 409 Conflict
    second_res = client.post(
        "/api/sessions/session_dup/recording",
        data={"exercise_id": "tech-caching", "take_number": 1},
        files={"audio": ("take_1.webm", VALID_WEBM_HEADER, "audio/webm")},
    )
    assert second_res.status_code == 409
    data = second_res.json()
    assert data["error"]["code"] == "TAKE_ALREADY_EXISTS"


def test_storage_write_failure_returns_500(client: TestClient):
    mock_storage = MagicMock()
    mock_storage.has_audio.return_value = False
    mock_storage.save_audio.side_effect = OSError("Disk I/O error during persistence")

    app.dependency_overrides[get_storage_service] = lambda: mock_storage

    response = client.post(
        "/api/sessions/session_disk_err/recording",
        data={"exercise_id": "tech-caching", "take_number": 1},
        files={"audio": ("take_1.webm", VALID_WEBM_HEADER, "audio/webm")},
    )
    assert response.status_code == 500
    data = response.json()
    assert data["error"]["code"] == "STORAGE_WRITE_FAILURE"


def test_development_mode_enforcement(client: TestClient):
    with patch.object(settings, "ENVIRONMENT", "production"):
        response = client.post(
            "/api/sessions/session_prod/recording",
            data={"exercise_id": "tech-caching", "take_number": 1},
            files={"audio": ("take_1.webm", VALID_WEBM_HEADER, "audio/webm")},
        )
        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == "DEVELOPMENT_ONLY_ENDPOINT"
        assert "disabled in production" in data["error"]["message"]


def test_loopback_restriction():
    # Simulate a request from a remote non-loopback IP
    with TestClient(app, client=("198.51.100.1", 54321)) as remote_client:
        response = remote_client.post(
            "/api/sessions/session_remote/recording",
            data={"exercise_id": "tech-caching", "take_number": 1},
            files={"audio": ("take_1.webm", VALID_WEBM_HEADER, "audio/webm")},
        )
        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == "FORBIDDEN_ORIGIN"
