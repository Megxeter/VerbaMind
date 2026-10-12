import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

from backend.core.config import settings
from backend.services.transcription import (
    TranscriptionResult,
    TranscriptionService,
    get_transcription_service,
)

logger = logging.getLogger("verbamind.transcription_worker")

MAX_QUEUE_CAPACITY = 5


class TranscriptionQueueFullError(Exception):
    """Raised when the background inference queue is saturated."""
    pass


@dataclass
class TranscriptionJob:
    """Represents a background speech transcription execution unit."""
    job_id: str
    session_id: str
    take_number: int
    status: str  # "queued" | "processing" | "completed" | "failed"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    transcript: Optional[TranscriptionResult] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "session_id": self.session_id,
            "take_number": self.take_number,
            "status": self.status,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
            "transcript": self.transcript.model_dump() if self.transcript else None,
            "error": self.error,
        }


class TranscriptionWorkerManager:
    """
    Manages bounded background speech transcription jobs.
    Uses a single background worker task to prevent overlapping CPU thrashing,
    running CTranslate2 inference outside the FastAPI async event loop.
    """

    def __init__(
        self,
        service: Optional[TranscriptionService] = None,
        max_queue_size: int = MAX_QUEUE_CAPACITY,
    ):
        self.service = service or get_transcription_service()
        self.max_queue_size = max_queue_size
        self.queue: asyncio.Queue[tuple[TranscriptionJob, Path]] = asyncio.Queue(maxsize=max_queue_size)
        self.jobs: Dict[str, TranscriptionJob] = {}
        self._worker_task: Optional[asyncio.Task] = None
        self._is_running = False

    def _job_key(self, session_id: str, take_number: int) -> str:
        return f"{session_id}:{take_number}"

    async def start(self):
        """Starts the background worker task."""
        if self._is_running:
            return
        self._is_running = True
        self._worker_task = asyncio.create_task(self._worker_loop(), name="transcription-worker")
        logger.info("TranscriptionWorkerManager started with bounded queue capacity=%d.", self.max_queue_size)

    async def stop(self):
        """Cancels and cleans up the background worker."""
        self._is_running = False
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("TranscriptionWorkerManager stopped.")

    async def _worker_loop(self):
        """Sequential single-worker queue processing loop."""
        while self._is_running:
            try:
                job, audio_path = await self.queue.get()
            except asyncio.CancelledError:
                break

            job.status = "processing"
            logger.info("Processing transcription job '%s' for session '%s' take %d...", job.job_id, job.session_id, job.take_number)

            try:
                # Offload heavy CTranslate2 / PyAV CPU inference to background thread
                result = await asyncio.to_thread(self.service.transcribe_file, audio_path)
                # Persist transcript atomically to session storage
                self.service.save_transcript(job.session_id, job.take_number, result)

                job.status = "completed"
                job.transcript = result
                job.completed_at = datetime.now(timezone.utc).isoformat()
                job.error = None
                logger.info("Completed transcription job '%s' in %.3fs.", job.job_id, result.processing_time_seconds)
            except Exception as exc:
                logger.error("Failed transcription job '%s': %s", job.job_id, exc, exc_info=True)
                job.status = "failed"
                job.error = str(exc)
                job.completed_at = datetime.now(timezone.utc).isoformat()
                job.transcript = None
            finally:
                self.queue.task_done()

    def get_job(self, session_id: str, take_number: int) -> Optional[TranscriptionJob]:
        """
        Retrieves a job by session and take number.
        Checks in-memory registry first; if not found, checks for completed
        transcript JSON on disk to support restarts.
        """
        key = self._job_key(session_id, take_number)
        job = self.jobs.get(key)
        if job:
            return job

        # Check if transcript already exists on disk (survives restart)
        saved_file = settings.STORAGE_DIR / session_id / f"transcript_take_{take_number}.json"
        if saved_file.exists():
            try:
                data = json.loads(saved_file.read_text(encoding="utf-8"))
                result = TranscriptionResult(**data)
                recovered_job = TranscriptionJob(
                    job_id=f"job_{session_id}_take_{take_number}",
                    session_id=session_id,
                    take_number=take_number,
                    status="completed",
                    created_at=result.created_at,
                    completed_at=result.created_at,
                    transcript=result,
                    error=None,
                )
                self.jobs[key] = recovered_job
                return recovered_job
            except Exception as exc:
                logger.warning("Failed to parse existing transcript file %s: %s", saved_file, exc)

        return None

    def submit_job(self, session_id: str, take_number: int, audio_path: Path) -> TranscriptionJob:
        """
        Enqueues a transcription job with idempotency and capacity checks.
        """
        key = self._job_key(session_id, take_number)
        existing = self.get_job(session_id, take_number)

        # 1. Idempotency: Return existing job if queued, processing, or completed
        if existing and existing.status in ("queued", "processing", "completed"):
            return existing

        # 2. Queue capacity guard
        if self.queue.full():
            raise TranscriptionQueueFullError(
                f"Transcription queue capacity ({self.max_queue_size}) reached. Please retry shortly."
            )

        # 3. Create and enqueue new job
        job_id = f"job_{session_id}_take_{take_number}"
        job = TranscriptionJob(
            job_id=job_id,
            session_id=session_id,
            take_number=take_number,
            status="queued",
        )
        self.jobs[key] = job

        try:
            self.queue.put_nowait((job, audio_path))
        except asyncio.QueueFull:
            raise TranscriptionQueueFullError(
                f"Transcription queue capacity ({self.max_queue_size}) reached. Please retry shortly."
            )

        logger.info("Enqueued transcription job '%s' (queue depth=%d).", job_id, self.queue.qsize())
        return job


# Global singleton manager
_worker_manager: Optional[TranscriptionWorkerManager] = None


def get_worker_manager() -> TranscriptionWorkerManager:
    """Provides the singleton TranscriptionWorkerManager instance."""
    global _worker_manager
    if _worker_manager is None:
        _worker_manager = TranscriptionWorkerManager()
    return _worker_manager
