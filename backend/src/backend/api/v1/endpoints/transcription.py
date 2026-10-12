import logging
import re
from pathlib import Path

from fastapi import APIRouter, Depends, Path as PathParam, Request, status
from fastapi.responses import JSONResponse

from backend.core.config import settings
from backend.services.storage import AudioStorageService, get_storage_service
from backend.services.transcription_worker import (
    TranscriptionQueueFullError,
    TranscriptionWorkerManager,
    get_worker_manager,
)

logger = logging.getLogger("verbamind.api.transcription")

router = APIRouter()

SESSION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")


def _resolve_recording_path(session_id: str, take_number: int) -> Path | None:
    """Finds the persisted audio file for a session and take number."""
    session_dir = settings.STORAGE_DIR / session_id
    if not session_dir.exists():
        return None
    candidates = list(session_dir.glob(f"take_{take_number}.*"))
    for c in candidates:
        if c.suffix.lower() in (".webm", ".wav", ".ogg", ".mp4", ".m4a") and c.stat().st_size > 0:
            return c
    return None


@router.post(
    "/sessions/{session_id}/recordings/{take_number}/transcribe",
    summary="Enqueue Speech Transcription Job",
    description="Asynchronously enqueues an offline transcription job for an existing recorded take.",
)
async def start_transcription(
    request: Request,
    session_id: str = PathParam(..., description="Unique practice session identifier", max_length=64),
    take_number: int = PathParam(..., description="Take sequence number", ge=1),
    worker_manager: TranscriptionWorkerManager = Depends(get_worker_manager),
) -> JSONResponse:
    # 1. Development Mode Guard
    if settings.ENVIRONMENT != "development":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": {
                    "code": "DEVELOPMENT_ONLY_ENDPOINT",
                    "message": "Transcription endpoints are disabled in production pending authentication enforcement.",
                }
            },
        )

    # 2. Loopback Host Guard
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": {
                    "code": "FORBIDDEN_ORIGIN",
                    "message": "Transcription endpoints are restricted to loopback connections.",
                }
            },
        )

    # 3. Path Traversal & Identifier Validation
    clean_session_id = session_id.strip()
    if not SESSION_ID_PATTERN.match(clean_session_id):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "INVALID_SESSION_ID",
                    "message": "Session ID contains invalid characters or path traversal sequences.",
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

    # 4. Resolve Audio Recording Target
    audio_path = _resolve_recording_path(clean_session_id, take_number)
    if not audio_path:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "RECORDING_NOT_FOUND",
                    "message": f"No audio recording found for session '{clean_session_id}' take {take_number}.",
                }
            },
        )

    # Ensure worker is started
    await worker_manager.start()

    # 5. Submit to Bounded Queue
    try:
        job = worker_manager.submit_job(clean_session_id, take_number, audio_path)
    except TranscriptionQueueFullError as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": {
                    "code": "TRANSCRIPTION_QUEUE_FULL",
                    "message": str(exc),
                }
            },
        )

    response_status = status.HTTP_200_OK if job.status == "completed" else status.HTTP_202_ACCEPTED
    return JSONResponse(
        status_code=response_status,
        content=job.to_dict(),
    )


@router.get(
    "/sessions/{session_id}/recordings/{take_number}/transcript",
    summary="Get Speech Transcription Status & Results",
    description="Polls the status of an enqueued transcription job or fetches the completed transcript.",
)
async def get_transcript(
    request: Request,
    session_id: str = PathParam(..., description="Unique practice session identifier", max_length=64),
    take_number: int = PathParam(..., description="Take sequence number", ge=1),
    worker_manager: TranscriptionWorkerManager = Depends(get_worker_manager),
) -> JSONResponse:
    # 1. Development Mode Guard
    if settings.ENVIRONMENT != "development":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": {
                    "code": "DEVELOPMENT_ONLY_ENDPOINT",
                    "message": "Transcription endpoints are disabled in production.",
                }
            },
        )

    # 2. Loopback Host Guard
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": {
                    "code": "FORBIDDEN_ORIGIN",
                    "message": "Transcription endpoints are restricted to loopback connections.",
                }
            },
        )

    clean_session_id = session_id.strip()
    if not SESSION_ID_PATTERN.match(clean_session_id):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "INVALID_SESSION_ID",
                    "message": "Session ID contains invalid characters.",
                }
            },
        )

    job = worker_manager.get_job(clean_session_id, take_number)
    if not job:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "TRANSCRIPT_NOT_FOUND",
                    "message": f"No active job or completed transcript found for session '{clean_session_id}' take {take_number}.",
                }
            },
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=job.to_dict(),
    )
