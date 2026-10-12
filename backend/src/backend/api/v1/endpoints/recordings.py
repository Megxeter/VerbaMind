import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Path, Request, UploadFile, status
from fastapi.responses import JSONResponse

from backend.core.config import settings
from backend.services.audio_validator import detect_audio_container
from backend.services.storage import AudioStorageService, get_storage_service

logger = logging.getLogger("verbamind.recordings")

router = APIRouter()

SESSION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")


@router.post(
    "/sessions/{session_id}/recording",
    status_code=status.HTTP_201_CREATED,
    summary="Upload Practice Recording Take",
    description="Uploads a validated audio recording take for private persistence.",
)
async def upload_recording(
    request: Request,
    session_id: str = Path(..., description="Unique practice session identifier", max_length=64),
    audio: UploadFile = File(..., description="Binary audio recording payload"),
    exercise_id: str = Form(..., description="Practice passage identifier", max_length=64),
    take_number: int = Form(1, description="Sequential attempt/take counter", ge=1),
    storage: AudioStorageService = Depends(get_storage_service),
) -> JSONResponse:
    # 1. Development Mode Guard (Prototype Safety)
    if settings.ENVIRONMENT != "development":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": {
                    "code": "DEVELOPMENT_ONLY_ENDPOINT",
                    "message": "Recording uploads are disabled in production mode pending authentication and ownership enforcement.",
                }
            },
        )

    # 2. Loopback Host Restriction
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": {
                    "code": "FORBIDDEN_ORIGIN",
                    "message": "Recording uploads are restricted to loopback connections.",
                }
            },
        )

    # 3. Path Traversal & Identifier Validation
    clean_session_id = session_id.strip()
    if not clean_session_id or not SESSION_ID_PATTERN.match(clean_session_id) or len(clean_session_id) > 64:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "INVALID_SESSION_ID",
                    "message": "Invalid session identifier. Must be alphanumeric with hyphens or underscores (max 64 characters).",
                }
            },
        )

    clean_exercise_id = exercise_id.strip()
    if not clean_exercise_id or not SESSION_ID_PATTERN.match(clean_exercise_id) or len(clean_exercise_id) > 64:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "INVALID_EXERCISE_ID",
                    "message": "Invalid exercise identifier. Must be alphanumeric with hyphens or underscores (max 64 characters).",
                }
            },
        )

    if take_number < 1:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "INVALID_TAKE_NUMBER",
                    "message": "Take number must be greater than or equal to 1.",
                }
            },
        )

    # 4. Check for Duplicate Take (Avoid Unintended Overwrites)
    if storage.has_audio(clean_session_id, take_number):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": {
                    "code": "TAKE_ALREADY_EXISTS",
                    "message": f"A recording for session '{clean_session_id}' take {take_number} already exists.",
                }
            },
        )

    # 5. Read Payload with Size & Empty Bounds
    audio_bytes = await audio.read(settings.MAX_AUDIO_BYTES + 1)
    if len(audio_bytes) > settings.MAX_AUDIO_BYTES:
        return JSONResponse(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            content={
                "error": {
                    "code": "PAYLOAD_TOO_LARGE",
                    "message": f"Audio payload exceeds maximum permitted limit of {settings.MAX_AUDIO_BYTES // (1024 * 1024)}MB.",
                }
            },
        )

    if len(audio_bytes) == 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "EMPTY_AUDIO_PAYLOAD",
                    "message": "Audio payload cannot be empty.",
                }
            },
        )

    # 6. Binary Magic Byte Sniffing (Do not trust client MIME or filename)
    detected_mime = detect_audio_container(audio_bytes)
    if not detected_mime:
        return JSONResponse(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            content={
                "error": {
                    "code": "UNSUPPORTED_MEDIA_TYPE",
                    "message": "Unsupported audio container. Only WebM, WAV, Ogg, and MP4/M4A containers are supported.",
                }
            },
        )

    # 7. Atomic Persistence
    try:
        saved_path = storage.save_audio(
            session_id=clean_session_id,
            take_number=take_number,
            data=audio_bytes,
            mime_type=detected_mime,
            overwrite=False,
        )
    except FileExistsError:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": {
                    "code": "TAKE_ALREADY_EXISTS",
                    "message": f"A recording for session '{clean_session_id}' take {take_number} already exists.",
                }
            },
        )
    except Exception as exc:
        logger.error("Failed to store audio recording: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "STORAGE_WRITE_FAILURE",
                    "message": "Failed to persist audio recording. Please try again.",
                }
            },
        )

    # 8. Success Response (Zero Filesystem Path Exposure)
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "session_id": clean_session_id,
            "exercise_id": clean_exercise_id,
            "take_number": take_number,
            "file_id": f"take_{take_number}{saved_path.suffix}",
            "byte_size": len(audio_bytes),
            "mime_type": detected_mime,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "uploaded",
        },
    )
