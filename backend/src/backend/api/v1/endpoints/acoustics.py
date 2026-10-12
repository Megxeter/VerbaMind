import asyncio
import json
import logging
import re
from pathlib import Path

from fastapi import APIRouter, Path as PathParam, Request, status
from fastapi.responses import JSONResponse

from backend.core.config import settings
from backend.services.acoustics import (
    analyze_audio_recording,
    load_acoustics,
    save_acoustics,
)

logger = logging.getLogger("verbamind.api.acoustics")

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


def _get_transcript_text_if_available(session_id: str, take_number: int) -> str | None:
    """Retrieves recognised transcript text if previously completed and stored on disk."""
    transcript_file = settings.STORAGE_DIR / session_id / f"transcript_take_{take_number}.json"
    if transcript_file.exists():
        try:
            data = json.loads(transcript_file.read_text(encoding="utf-8"))
            return data.get("text")
        except Exception as exc:
            logger.warning("Could not read transcript text from %s: %s", transcript_file, exc)
    return None


@router.post(
    "/sessions/{session_id}/recordings/{take_number}/acoustics",
    summary="Execute Acoustic Audio Analysis",
    description="Analyzes speech timing, activity ratio, leading/trailing silence, internal gaps, and transcript-derived WPM.",
)
async def analyze_recording_acoustics(
    request: Request,
    session_id: str = PathParam(..., description="Unique practice session identifier", max_length=64),
    take_number: int = PathParam(..., description="Take sequence number", ge=1),
) -> JSONResponse:
    # 1. Development Mode Guard
    if settings.ENVIRONMENT != "development":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": {
                    "code": "DEVELOPMENT_ONLY_ENDPOINT",
                    "message": "Acoustic analysis endpoints are disabled in production pending authentication enforcement.",
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
                    "message": "Acoustic analysis endpoints are restricted to loopback connections.",
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

    # 5. Check if transcript is already available for WPM derivation
    transcript_text = _get_transcript_text_if_available(clean_session_id, take_number)

    # 6. Execute acoustic analysis offloaded to background thread to protect event loop
    try:
        result = await asyncio.to_thread(
            analyze_audio_recording,
            audio_path,
            transcript_text=transcript_text,
        )
        save_acoustics(clean_session_id, take_number, result)
        logger.info(
            "Acoustic analysis completed for session '%s' take %d (duration=%.2fs, speech=%.2fs, gaps=%d).",
            clean_session_id,
            take_number,
            result.total_duration_seconds,
            result.detected_speech_duration_seconds,
            result.internal_gap_count,
        )
        return JSONResponse(status_code=status.HTTP_200_OK, content=result.to_dict())
    except Exception as exc:
        logger.error("Failed acoustic analysis for session '%s' take %d: %s", clean_session_id, take_number, exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "ACOUSTIC_ANALYSIS_FAILED",
                    "message": f"Acoustic analysis failed: {str(exc)}",
                }
            },
        )


@router.get(
    "/sessions/{session_id}/recordings/{take_number}/acoustics",
    summary="Get Acoustic Analysis Results",
    description="Fetches cached acoustic analysis results or executes analysis if recording exists.",
)
async def get_recording_acoustics(
    request: Request,
    session_id: str = PathParam(..., description="Unique practice session identifier", max_length=64),
    take_number: int = PathParam(..., description="Take sequence number", ge=1),
) -> JSONResponse:
    # 1. Development Mode Guard
    if settings.ENVIRONMENT != "development":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": {
                    "code": "DEVELOPMENT_ONLY_ENDPOINT",
                    "message": "Acoustic analysis endpoints are disabled in production.",
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
                    "message": "Acoustic analysis endpoints are restricted to loopback connections.",
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

    # Check cached results on disk
    cached = load_acoustics(clean_session_id, take_number)
    if cached:
        return JSONResponse(status_code=status.HTTP_200_OK, content=cached)

    # If not cached, check if recording exists and analyze
    audio_path = _resolve_recording_path(clean_session_id, take_number)
    if not audio_path:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "ACOUSTICS_NOT_FOUND",
                    "message": f"No acoustic results or audio recording found for session '{clean_session_id}' take {take_number}.",
                }
            },
        )

    transcript_text = _get_transcript_text_if_available(clean_session_id, take_number)
    try:
        result = await asyncio.to_thread(
            analyze_audio_recording,
            audio_path,
            transcript_text=transcript_text,
        )
        save_acoustics(clean_session_id, take_number, result)
        return JSONResponse(status_code=status.HTTP_200_OK, content=result.to_dict())
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "ACOUSTIC_ANALYSIS_FAILED",
                    "message": str(exc),
                }
            },
        )
