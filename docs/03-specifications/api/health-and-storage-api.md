# VERBAMIND API Specification: Health Probe & Private Audio Storage

**Version**: `0.1.0`  
**Base URL**: `http://127.0.0.1:8000/api`  
**Status**: Implemented (`/api/health`), Specification Phase (`/api/sessions/{session_id}/recording`)

---

## 1. Global Policies

### 1.1 CORS Policy
Cross-Origin Resource Sharing is strictly constrained to authorized frontend development origins to prevent unauthorized cross-origin web scripts from reading API responses.
- **Allowed Origins**:
  - `http://127.0.0.1:5173` (Vite dev server)
  - `http://localhost:5173`
  - `http://127.0.0.1:4173` (Vite preview server)
  - `http://localhost:4173`
- **Wildcards**: `*` is explicitly prohibited.
- **Allowed Methods**: `GET`, `POST`, `OPTIONS`.
- **Allowed Headers**: `Content-Type`, `Authorization`.
- **Accurate Boundary Definition**: CORS is a browser-enforced mechanism that relaxes or enforces the Same-Origin Policy (SOP). It is **not** caller authentication (non-browser tools such as `curl` or automated clients do not enforce CORS), nor is it a **complete CSRF defense** (simple cross-origin form submissions can still be dispatched across origins without CORS preflights; token-based CSRF protection, SameSite cookie attributes, and session authentication provide complete request defense).

### 1.2 Error Envelope Standard
All application errors return a structured JSON object adhering to this schema (implemented in `backend.core.errors`):

```json
{
  "error": {
    "code": "HTTP_404 | HTTP_400 | VALIDATION_ERROR | INTERNAL_SERVER_ERROR",
    "message": "Descriptive, client-safe error message",
    "details": [
      {
        "field": "body -> exercise_id",
        "issue": "Field required"
      }
    ]
  }
}
```

*Note: Unhandled 500 internal server errors log the traceback on the server but strip all exception details, database connection strings, and file system paths from the client response, returning code `"INTERNAL_SERVER_ERROR"`.*

---

## 2. Endpoints

### 2.1 Health & Service Liveness Probe
Retrieves runtime health and build metadata for service discovery and frontend connectivity status indication.

- **Method**: `GET`
- **Path**: `/api/health`
- **Authentication**: None (Public diagnostic probe)
- **Response**: `200 OK`
- **Schema**:
  | Field | Type | Description |
  | :--- | :--- | :--- |
  | `status` | `string` | Service status (`"healthy"`) |
  | `service` | `string` | Service identifier (`"verbamind-api"`) |
  | `version` | `string` | Semantic version (`"0.1.0"`) |
  | `timestamp` | `string (date-time)` | ISO 8601 UTC timestamp |
  | `environment` | `string` | Runtime environment (`"development"` / `"production"`) |

- **Sample 200 Response**:
  ```json
  {
    "status": "healthy",
    "service": "verbamind-api",
    "version": "0.1.0",
    "timestamp": "2026-10-11T17:38:30.282617+00:00",
    "environment": "development"
  }
  ```

---

### 2.2 Audio Recording Upload (Task 2.2 — Implemented & Verified)
Accepts user speech recording for a practice session and persists it into the private storage layer using server-controlled paths and atomic writes.

- **Method**: `POST`
- **Path**: `/api/sessions/{session_id}/recording`
- **Content-Type**: `multipart/form-data`
- **Environment & Access Guard**:
  - Restricted to development mode (`ENVIRONMENT="development"`). In non-development mode, returns `403 Forbidden` (`DEVELOPMENT_ONLY_ENDPOINT`).
  - Restricted to loopback client hosts (`127.0.0.1`, `::1`, `localhost`). Non-loopback requests return `403 Forbidden` (`FORBIDDEN_ORIGIN`).
  - *Note*: Production authentication and session ownership checks are scheduled for subsequent milestones.
- **Path Parameters**:
  - `session_id` (`string`, regex: `^[a-zA-Z0-9_\-]+$`, 1–64 characters): Unique practice session identifier. Traversal sequences (`..`, `/`, `\`) or invalid characters return `400 Bad Request` (`INVALID_SESSION_ID`).
- **Form Fields (multipart/form-data)**:
  - `audio` (`UploadFile`, binary, required): Audio recording payload.
  - `exercise_id` (`string`, regex: `^[a-zA-Z0-9_\-]+$`, required): Practice passage ID being attempted.
  - `take_number` (`integer`, required, $\ge 1$, default: 1): Practice attempt counter.
- **Server Validation Pipeline (Independent of Client Headers)**:
  1. **Non-Empty Check**: Empty payloads (0 bytes) return `400 Bad Request` (`EMPTY_AUDIO_PAYLOAD`).
  2. **Size Upper Bound**: Payloads $> 15\text{ MB}$ ($15{,}728{,}640$ bytes) return `413 Request Entity Too Large` (`PAYLOAD_TOO_LARGE`).
  3. **Binary Magic Byte Sniffing**: Does not trust client-supplied filenames or `Content-Type` headers. Inspects binary header:
     - WebM: EBML header ID `\x1a\x45\xdf\xa3` -> `audio/webm`
     - Ogg: `OggS` header -> `audio/ogg`
     - WAV: `RIFF` ... `WAVE` -> `audio/wav`
     - MP4/M4A: `ftyp` at offset 4 -> `audio/mp4`
     - Non-matching bytes return `415 Unsupported Media Type` (`UNSUPPORTED_MEDIA_TYPE`).
  4. **Unintended Overwrite Protection**: If a recording already exists for the given `(session_id, take_number)`, returns `409 Conflict` (`TAKE_ALREADY_EXISTS`).
  5. **Atomic Write Storage**: Storage adapter writes to an isolated `.tmp` file before atomically replacing (`os.replace`) to prevent partial or corrupted file writes.
- **Error Responses**:
  | Status Code | Error Code | Condition |
  | :--- | :--- | :--- |
  | `400 Bad Request` | `INVALID_SESSION_ID` | Session ID contains path traversal or invalid characters |
  | `400 Bad Request` | `INVALID_EXERCISE_ID` | Exercise ID is empty or contains invalid characters |
  | `400 Bad Request` | `INVALID_TAKE_NUMBER` | Take number is less than 1 |
  | `400 Bad Request` | `EMPTY_AUDIO_PAYLOAD` | Audio payload byte length is 0 |
  | `403 Forbidden` | `DEVELOPMENT_ONLY_ENDPOINT` | Attempted upload while running in production environment |
  | `403 Forbidden` | `FORBIDDEN_ORIGIN` | Attempted upload from non-loopback client host |
  | `409 Conflict` | `TAKE_ALREADY_EXISTS` | A recording for this session and take number already exists |
  | `413 Payload Too Large` | `PAYLOAD_TOO_LARGE` | Uploaded audio exceeds 15 MB limit |
  | `415 Unsupported Media Type` | `UNSUPPORTED_MEDIA_TYPE` | Binary header does not match WebM, WAV, Ogg, or MP4/M4A |
  | `500 Internal Server Error` | `STORAGE_WRITE_FAILURE` | Storage adapter encountered an I/O failure during persistence |

- **Sample 201 Created Response**:
  ```json
  {
    "session_id": "session_abc123",
    "exercise_id": "tech-distributed-caching",
    "take_number": 1,
    "file_id": "take_1.webm",
    "byte_size": 284192,
    "mime_type": "audio/webm",
    "created_at": "2026-10-12T13:00:00.000000Z",
    "status": "uploaded"
  }
  ```
  *(Note: Internal filesystem paths are never exposed in the response payload or client errors.)*

---

### 2.3 Initiate Speech Transcription Job (Task 2.3B)
Enqueues an offline speech transcription job for an existing persisted audio take using faster-whisper.

- **Method**: `POST`
- **Path**: `/api/sessions/{session_id}/recordings/{take_number}/transcribe`
- **Environment & Host Guard**:
  - Restricted to development mode (`ENVIRONMENT="development"`). In non-development mode, returns `403 Forbidden` (`DEVELOPMENT_ONLY_ENDPOINT`).
  - Restricted to loopback client hosts (`127.0.0.1`, `::1`, `localhost`, `testclient`). Non-loopback requests return `403 Forbidden` (`FORBIDDEN_ORIGIN`).
- **Path Parameters**:
  - `session_id` (`string`, regex: `^[a-zA-Z0-9_\-]+$`, 1–64 characters).
  - `take_number` (`integer`, $\ge 1$).
- **Execution Architecture & Limits**:
  - **Bounded Single Worker**: Dispatches to a single background worker task running outside the FastAPI event loop (`asyncio.to_thread`).
  - **Bounded Queue**: Queue capacity is strictly capped at 5 pending jobs. If the queue is saturated, returns `503 Service Unavailable` (`TRANSCRIPTION_QUEUE_FULL`).
  - **Duplicate Job Protection**: If a job for `(session_id, take_number)` is already `queued` or `processing`, returns the existing job status without duplicating inference.
  - **Completed Cache**: If a completed transcript already exists on disk, returns `200 OK` with the completed result immediately.
  - **In-Memory Restart Behavior**: Active queued or in-flight jobs reside in memory; they do not survive a server restart. If the server restarts, previously in-flight jobs must be re-requested. Persisted completed transcripts on disk survive restarts.
- **Error Responses**:
  | Status Code | Error Code | Condition |
  | :--- | :--- | :--- |
  | `400 Bad Request` | `INVALID_SESSION_ID` | Session ID contains path traversal or invalid characters |
  | `400 Bad Request` | `INVALID_TAKE_NUMBER` | Take number is less than 1 |
  | `403 Forbidden` | `DEVELOPMENT_ONLY_ENDPOINT` | Non-development environment |
  | `403 Forbidden` | `FORBIDDEN_ORIGIN` | Non-loopback host origin |
  | `404 Not Found` | `RECORDING_NOT_FOUND` | No audio recording exists for this session take |
  | `503 Service Unavailable` | `TRANSCRIPTION_QUEUE_FULL` | Worker queue has reached maximum capacity (5 jobs) |

- **Sample 202 Accepted Response**:
  ```json
  {
    "job_id": "job_sess_123_take_1",
    "session_id": "sess_123",
    "take_number": 1,
    "status": "queued",
    "created_at": "2026-10-12T13:45:00.000000Z",
    "error": null
  }
  ```

---

### 2.4 Retrieve Transcription Status & Result (Task 2.3B)
Polls the current status of a transcription job or fetches the completed transcript.

- **Method**: `GET`
- **Path**: `/api/sessions/{session_id}/recordings/{take_number}/transcript`
- **Environment & Host Guard**: Same loopback and development guards apply.
- **Path Parameters**:
  - `session_id` (`string`, regex: `^[a-zA-Z0-9_\-]+$`, 1–64 characters).
  - `take_number` (`integer`, $\ge 1$).
- **Responses**:
  - `200 OK` (when `queued` or `processing`): Returns current state, `transcript: null`, `error: null`.
  - `200 OK` (when `completed`): Returns `status: "completed"`, `completed_at`, and structured `transcript` object containing full `text`, `segments`, `words` with timestamps, `language`, `duration_seconds`, and `processing_time_seconds`.
  - `200 OK` (when `failed`): Returns `status: "failed"`, `transcript: null`, and descriptive `error` message.
  - `404 Not Found` (`TRANSCRIPT_NOT_FOUND`): Neither an active job nor a saved transcript exists.
- **Sample 200 Completed Payload**:
  ```json
  {
    "job_id": "job_sess_123_take_1",
    "session_id": "sess_123",
    "take_number": 1,
    "status": "completed",
    "created_at": "2026-10-12T13:45:00.000000Z",
    "completed_at": "2026-10-12T13:45:04.688000Z",
    "transcript": {
      "text": "Hello and thank you for this opportunity...",
      "segments": [
        {
          "id": 1,
          "seek": 0,
          "start": 1.7,
          "end": 7.26,
          "text": "Hello and thank you for this opportunity...",
          "words": [
            { "word": "Hello", "start": 1.7, "end": 2.4, "probability": 0.594 }
          ]
        }
      ],
      "language": "en",
      "language_probability": 1.0,
      "duration_seconds": 47.16,
      "processing_time_seconds": 4.688,
      "model_name": "base.en",
      "device": "cpu",
      "compute_type": "int8",
      "word_count": 96
    },
    "error": null
  }
  ```
  *(Note: Zero server paths are returned. Model token probabilities are strictly acoustic metrics, not pronunciation or fluency scores.)*

---

### 2.5 Job Durability, Queue Capacity & Server Restart Behavior
1. **Queue Capacity**: Development queue bounded at `maxsize = 5`. If 5 jobs are currently queued awaiting execution, subsequent submissions immediately receive `503 Service Unavailable` with `TRANSCRIPTION_QUEUE_FULL`.
2. **Worker Concurrency**: A single dedicated worker thread executes PyAV audio decoding and Faster-Whisper inference off FastAPI's main async event loop.
3. **In-Flight Jobs (Restart Limitation)**: `queued` and `processing` jobs are managed in an in-memory `asyncio.Queue` and dictionary. They **do not survive a server process restart**. If the backend server restarts while a job is running or waiting, its memory state is reset. Clients polling will receive `404 Not Found` (`TRANSCRIPT_NOT_FOUND`) and can safely click "Retry Transcription" without losing their audio recording.
4. **Completed Transcripts (Persisted)**: Transcripts that reach `completed` are written atomically to disk (`transcript_take_{take_number}.json`) inside the private, Git-ignored session recording folder. These persisted transcripts **do survive server restarts** and are immediately returned with `status: completed` upon subsequent queries.

---

### 2.6 Analyze Speech Delivery Acoustics (Day 3 Increment 7 — Implemented & Verified)
Executes local audio acoustic rhythm and pause analysis on a persisted recording take, returning duration, speech-active duration, speech-activity percentage, leading/trailing silence, internal non-speech gaps ($\ge 250\text{ ms}$), and speaking/articulation rate (WPM).

- **Method**: `POST`
- **Path**: `/api/sessions/{session_id}/recordings/{take_number}/acoustics`
- **Environment & Host Guard**:
  - Restricted to development mode (`ENVIRONMENT="development"`). Non-dev mode returns `403 Forbidden` (`DEVELOPMENT_ONLY_ENDPOINT`).
  - Restricted to loopback client hosts (`127.0.0.1`, `::1`, `localhost`, `testclient`). Non-loopback requests return `403 Forbidden` (`FORBIDDEN_ORIGIN`).
- **Path Parameters**:
  - `session_id` (`string`, regex: `^[a-zA-Z0-9_\-]+$`, 1–64 characters). Traversal sequences (`..`, `/`, `\`) return `400 Bad Request` (`INVALID_SESSION_ID`).
  - `take_number` (`integer`, $\ge 1$).
- **Processing Architecture**:
  - Offloaded off FastAPI's main async event loop via `asyncio.to_thread` to prevent blocking concurrent API requests.
  - Decodes audio in memory using PyAV (`16 kHz`, mono, 16-bit float).
  - Energy RMS frame analysis: 25ms frame window ($N=400$), 10ms frame hop ($H=160$), calibrated threshold at $-40\text{ dBFS}$ with $150\text{ ms}$ hangover window smoothing.
  - Automatically loads persisted transcript if available (`transcript_take_{take_number}.json`) to compute estimated words per minute (WPM).
  - Persists analysis result to disk atomically at `acoustics_take_{take_number}.json` in the private, Git-ignored session recording directory.
- **Error Responses**:
  | Status Code | Error Code | Condition |
  | :--- | :--- | :--- |
  | `400 Bad Request` | `INVALID_SESSION_ID` | Session ID contains path traversal or invalid characters |
  | `400 Bad Request` | `INVALID_TAKE_NUMBER` | Take number is less than 1 |
  | `403 Forbidden` | `DEVELOPMENT_ONLY_ENDPOINT` | Attempted analysis while running in non-development environment |
  | `403 Forbidden` | `FORBIDDEN_ORIGIN` | Attempted analysis from non-loopback client host |
  | `404 Not Found` | `RECORDING_NOT_FOUND` | No audio recording exists for the specified session and take number |
  | `500 Internal Server Error` | `ACOUSTIC_ANALYSIS_FAILED` | PyAV decoding or acoustic processing failure |

- **Sample 200 OK Response**:
  ```json
  {
    "session_id": "session_abc123",
    "take_number": 1,
    "status": "completed",
    "measurements": {
      "recording_duration_seconds": 47.16,
      "speech_active_duration_seconds": 41.02,
      "speech_activity_ratio": 0.8698,
      "speech_activity_percentage": 86.98,
      "leading_silence_seconds": 0.44,
      "trailing_silence_seconds": 0.70,
      "internal_gap_count": 2,
      "total_internal_gap_duration_seconds": 1.62,
      "mean_internal_gap_duration_seconds": 0.81,
      "internal_gaps": [
        {
          "start_seconds": 12.40,
          "end_seconds": 13.34,
          "duration_seconds": 0.94
        },
        {
          "start_seconds": 28.10,
          "end_seconds": 28.78,
          "duration_seconds": 0.68
        }
      ],
      "transcript_word_count": 96,
      "words_per_minute": 122.14,
      "articulation_wpm": 140.42,
      "threshold_db": -40.0,
      "frame_duration_ms": 25.0,
      "frame_hop_ms": 10.0,
      "min_gap_duration_ms": 250.0,
      "hangover_duration_ms": 150.0
    },
    "analyzed_at": "2026-10-12T19:40:00.000000Z"
  }
  ```

---

### 2.7 Retrieve Persisted Delivery Acoustics
Retrieves previously computed acoustic measurements from disk cache without re-decoding audio.

- **Method**: `GET`
- **Path**: `/api/sessions/{session_id}/recordings/{take_number}/acoustics`
- **Environment & Host Guard**: Same loopback and development-only restrictions apply.
- **Responses**:
  - `200 OK`: Returns the JSON payload identical to section 2.6.
  - `404 Not Found`: If no acoustic analysis has yet been run for this take (`ACOUSTICS_NOT_FOUND`).


