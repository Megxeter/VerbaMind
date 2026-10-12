# Feature Specification 004: Transcription API & Browser UI Integration

## 1. Context & Scope
Task 2.3B connects the offline speech transcription engine (`faster-whisper` via CTranslate2 and PyAV) to the web platform.
Following project invariants:
- **Scope Boundary**: Strictly focused on audio decoding and speech-to-text transcription with word timestamps. Fluency metrics, pause boundary analysis, pronunciation assessment, and reading-accuracy scoring are deferred to subsequent increments.
- **Privacy & Self-Hosting**: 100% self-hosted, private persistence. No external cloud inference APIs, no remote data transfers.
- **Development Boundary**: Restricted to loopback development mode (`ENVIRONMENT="development"`). In non-development mode, endpoints return HTTP 403 pending full authentication.

---

## 2. Backend Architecture & Background Worker

### A. Non-Blocking Worker & Bounded Queue
Whisper inference is CPU-bound. To prevent blocking the FastAPI asynchronous event loop (which would cause health probes and audio uploads to stall):
1. **Inference Worker**: A dedicated background worker executes inference jobs using `asyncio.to_thread` to delegate CTranslate2 execution to background threads.
2. **Worker Concurrency**: Single worker (`max_workers=1`). Processes exactly one audio transcription job at a time.
3. **Bounded Queue Capacity**: The job queue has a strict maximum size of **5 pending jobs** (`maxsize=5`). If a request arrives while the queue is full, the server rejects it with `503 Service Unavailable` (`TRANSCRIPTION_QUEUE_FULL`).
4. **Preloaded Model**: Model weights are loaded once upon worker initialization (`local_files_only=True`) and reused across jobs, avoiding multi-second model loading latency per request.
5. **State Tracking**: Jobs transition through `queued` $\to$ `processing` $\to$ `completed` | `failed`.
6. **Duplicate Job Protection**: If a job for `(session_id, take_number)` is currently `queued` or `processing`, subsequent requests return the existing job representation without enqueueing duplicates.
7. **Restart Behavior**: In-memory queued or processing jobs are terminated if the server restarts. However, completed transcripts persisted to disk (`transcript_take_{take_number}.json`) survive server restarts and are immediately returned.

---

## 3. Frontend Integration Contract

1. **Transcribe Action Trigger**: A "Transcribe Speech" action renders on the audio player after a recording take is successfully uploaded to local storage.
2. **State Progression**:
   - `idle`: Transcribe button enabled.
   - `queued` / `processing`: Transcribe button disabled with loading spinner (`Transcribing take...`). No artificial percentage counters are invented.
   - `completed`: Displays the recognized transcript text safely as plain text, segment details, word count, and processing duration.
   - `failed`: Displays an alert banner explaining the error with a "Retry Transcription" button; local recording and playback remain completely intact.
3. **Take Transition Hygiene**: When the user records a new take (Take #2), all transcript states, text, and polling timers are immediately reset. Stale results from previous takes are ignored.
4. **Pedagogical Disclaimer**: Renders an advisory notice: *"Speech transcription may contain recognition errors. Token probabilities are acoustic decoder confidences, not pronunciation clarity or fluency scores."*
