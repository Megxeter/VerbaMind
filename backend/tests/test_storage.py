import pytest
from pathlib import Path
from backend.services.storage import LocalStorageService


@pytest.fixture
def temp_storage(tmp_path: Path) -> LocalStorageService:
    return LocalStorageService(storage_dir=tmp_path / "test_storage")


def test_save_and_retrieve_audio(temp_storage: LocalStorageService) -> None:
    session_id = "session_abc_123"
    take_number = 1
    sample_data = b"RIFF-fake-audio-payload"

    file_path = temp_storage.save_audio(session_id, take_number, sample_data, mime_type="audio/webm")
    assert file_path.exists()
    assert file_path.name == "take_1.webm"
    assert file_path.read_bytes() == sample_data

    # Retrieve
    retrieved_path = temp_storage.get_audio_path(session_id, take_number)
    assert retrieved_path == file_path
    assert temp_storage.has_audio(session_id, take_number) is True


def test_delete_audio(temp_storage: LocalStorageService) -> None:
    session_id = "session_xyz"
    take_number = 2
    temp_storage.save_audio(session_id, take_number, b"audio-data")

    assert temp_storage.has_audio(session_id, take_number) is True
    deleted = temp_storage.delete_audio(session_id, take_number)
    assert deleted is True
    assert temp_storage.has_audio(session_id, take_number) is False


def test_path_traversal_prevention(temp_storage: LocalStorageService) -> None:
    # Attempt directory traversal via session_id
    with pytest.raises(ValueError):
        temp_storage.save_audio("../../../etc", 1, b"malicious")

    with pytest.raises(ValueError):
        temp_storage.save_audio("session/subfolder", 1, b"malicious")

    with pytest.raises(ValueError):
        temp_storage.save_audio("", 1, b"empty")


def test_oversized_audio_rejection(temp_storage: LocalStorageService) -> None:
    huge_data = b"0" * (16 * 1024 * 1024)  # 16MB > 15MB limit
    with pytest.raises(ValueError, match="exceeds maximum limit"):
        temp_storage.save_audio("session_limit", 1, huge_data)
