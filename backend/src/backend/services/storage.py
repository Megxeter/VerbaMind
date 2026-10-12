import os
import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from backend.core.config import settings

# Strict session identifier pattern to prevent path traversal
SESSION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")


class AudioStorageService(ABC):
    """Abstract interface for private audio recording storage."""

    @abstractmethod
    def save_audio(
        self,
        session_id: str,
        take_number: int,
        data: bytes,
        mime_type: str = "audio/webm",
        overwrite: bool = False,
    ) -> Path:
        """Store audio payload privately and return the internal file path."""
        pass

    @abstractmethod
    def get_audio_path(self, session_id: str, take_number: int) -> Optional[Path]:
        """Retrieve path to private audio recording if it exists."""
        pass

    @abstractmethod
    def delete_audio(self, session_id: str, take_number: int) -> bool:
        """Permanently delete an audio recording."""
        pass

    @abstractmethod
    def has_audio(self, session_id: str, take_number: int) -> bool:
        """Check if an audio recording exists."""
        pass


class LocalStorageService(AudioStorageService):
    """Local filesystem private audio storage adapter.
    
    Security & Privacy Guarantees:
    1. Audio files are stored outside the public document root.
    2. Path traversal attempts are blocked via strict regex validation and relative_to checks.
    3. No static file route exists in the application serving this directory.
    """

    def __init__(self, storage_dir: Optional[Path] = None) -> None:
        self.storage_dir = (storage_dir or settings.STORAGE_DIR).resolve()
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _sanitize_session_id(self, session_id: str) -> str:
        clean_id = session_id.strip()
        if not clean_id or not SESSION_ID_PATTERN.match(clean_id):
            raise ValueError(
                f"Invalid session identifier '{session_id}'. Must be alphanumeric with hyphens/underscores."
            )
        return clean_id

    def _get_extension(self, mime_type: str) -> str:
        clean_mime = mime_type.lower()
        if "ogg" in clean_mime:
            return ".ogg"
        if "wav" in clean_mime:
            return ".wav"
        if "mp4" in clean_mime or "aac" in clean_mime:
            return ".m4a"
        return ".webm"  # default browser container

    def _resolve_session_dir(self, session_id: str) -> Path:
        sanitized = self._sanitize_session_id(session_id)
        session_dir = (self.storage_dir / sanitized).resolve()
        # Path traversal guard
        if not session_dir.is_relative_to(self.storage_dir):
            raise PermissionError("Directory traversal detected.")
        return session_dir

    def save_audio(
        self,
        session_id: str,
        take_number: int,
        data: bytes,
        mime_type: str = "audio/webm",
        overwrite: bool = False,
    ) -> Path:
        if len(data) == 0:
            raise ValueError("Audio payload cannot be empty.")
        if len(data) > settings.MAX_AUDIO_BYTES:
            raise ValueError(
                f"Audio payload ({len(data)} bytes) exceeds maximum limit of {settings.MAX_AUDIO_BYTES} bytes."
            )
        if take_number < 1:
            raise ValueError("Take number must be greater than or equal to 1.")

        session_dir = self._resolve_session_dir(session_id)
        session_dir.mkdir(parents=True, exist_ok=True)

        extension = self._get_extension(mime_type)
        target_file = session_dir / f"take_{take_number}{extension}"

        # Prevent unintended overwrites unless explicitly requested
        if not overwrite and (target_file.exists() or self.has_audio(session_id, take_number)):
            raise FileExistsError(
                f"A recording already exists for session '{session_id}' take {take_number}."
            )

        # Atomic write: write to isolated temp file in session_dir then atomically replace
        temp_file = session_dir / f".take_{take_number}_{os.urandom(8).hex()}.tmp"
        try:
            temp_file.write_bytes(data)
            # Set restrictive permissions on POSIX systems if supported
            try:
                os.chmod(temp_file, 0o600)
            except (AttributeError, OSError):
                pass
            os.replace(temp_file, target_file)
        except Exception:
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except OSError:
                    pass
            raise

        return target_file

    def get_audio_path(self, session_id: str, take_number: int) -> Optional[Path]:
        session_dir = self._resolve_session_dir(session_id)
        if not session_dir.exists():
            return None

        # Search for any take_{take_number}.* matching file
        for ext in [".webm", ".wav", ".ogg", ".m4a"]:
            candidate = session_dir / f"take_{take_number}{ext}"
            if candidate.exists() and candidate.is_file():
                return candidate
        return None

    def delete_audio(self, session_id: str, take_number: int) -> bool:
        path = self.get_audio_path(session_id, take_number)
        if path and path.exists():
            path.unlink()
            # Clean up empty session directory if no other files remain
            session_dir = path.parent
            if session_dir.exists() and not any(session_dir.iterdir()):
                session_dir.rmdir()
            return True
        return False

    def has_audio(self, session_id: str, take_number: int) -> bool:
        return self.get_audio_path(session_id, take_number) is not None


_default_storage_service: Optional[LocalStorageService] = None


def get_storage_service() -> AudioStorageService:
    """Dependency provider returning the configured AudioStorageService."""
    global _default_storage_service
    if _default_storage_service is None:
        _default_storage_service = LocalStorageService()
    return _default_storage_service

