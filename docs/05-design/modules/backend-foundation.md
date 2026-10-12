# Module Low-Level Design: Backend Foundation & Audio Storage (LLD)

**Module**: `backend.core`, `backend.services.storage`, `backend.services.audio_validator`, & `backend.api.v1.endpoints.recordings`  
**Phase**: Milestone 2 — Tasks 2.1 & 2.2  
**Status**: Implemented & Verified  

---

## 1. Module Responsibilities & Seams

In accordance with our codebase design principles, the backend foundation isolates configuration, errors, audio validation, and audio persistence behind deep seams with minimal surface area.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND ARCHITECTURAL SEAMS                     │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│ Seam / Interface    │ Concrete Adapter         │ Depth & Leverage      │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ `Settings`          │ Pydantic BaseSettings    │ Centralized typed env │
│                     │ (`core.config`)          │ parsing & CORS lists  │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ `register_error_    │ Starlette/FastAPI        │ Uniform error JSON;   │
│  handlers(app)`     │ Exception Handlers       │ sanitizes 404, 422,   │
│                     │ (`core.errors`)          │ and strips 500 traces │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ `AudioStorage       │ `LocalStorageService`    │ Atomic .tmp writes,   │
│  Service` (ABC)     │ (`services.storage`)     │ overwrite locks,      │
│                     │                          │ private ACLs, no HTTP │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ `detect_audio_      │ Binary sniffer           │ Content-based magic   │
│  container(data)`   │ (`audio_validator`)      │ byte detection (WebM, │
│                     │                          │ WAV, Ogg, MP4)        │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ `upload_recording`  │ FastAPI router           │ Boundary enforcement, │
│  endpoint           │ (`api.v1.recordings`)    │ loopback & dev guards,│
│                     │                          │ payload bounds        │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ `useAudioUpload`    │ React Hook               │ Client pre-checks,    │
│                     │ (`frontend/src/hooks`)   │ idempotency, retry    │
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

---

## 2. API Contract: Health Check

- **Method**: `GET`
- **Route**: `/api/health`
- **Auth**: None (Public diagnostic probe)
- **Response Model**: `HealthResponse`
- **Status Code**: `200 OK`
- **Sample Payload**:
  ```json
  {
    "status": "healthy",
    "service": "verbamind-api",
    "version": "0.1.0",
    "timestamp": "2026-10-11T17:30:54.271773+00:00",
    "environment": "development"
  }
  ```

---

## 3. Standardized Error Handling Architecture

Application exceptions are handled through uniform, sanitized JSON envelopes implemented in `backend.core.errors`:

1. **HTTP Exceptions (`StarletteHTTPException`)**:
   - Status code: Mirrors the exception status (e.g., 404, 400).
   - Error code: Prefixed by status code: `HTTP_<status_code>` (e.g., `"HTTP_404"`).
   - Schema:
     ```json
     {
       "error": {
         "code": "HTTP_404",
         "message": "Not Found"
       }
     }
     ```
2. **Request Validation Errors (`RequestValidationError`)**:
   - Status code: `422 Unprocessable Entity`.
   - Error code: `"VALIDATION_ERROR"`.
   - Sanitization: Replaces raw Pydantic internal structures with sanitized `field` and `issue` pairs.
   - Schema:
     ```json
     {
       "error": {
         "code": "VALIDATION_ERROR",
         "message": "The request payload failed validation.",
         "details": [
           { "field": "body -> session_id", "issue": "Field required" }
         ]
       }
     }
     ```
3. **Unhandled Server Exceptions (`Exception`)**:
   - Status code: `500 Internal Server Error`.
   - Error code: `"INTERNAL_SERVER_ERROR"`.
   - Information Leakage Defense: Exception tracebacks and internal details are logged server-side only; response payloads never leak stack traces, database strings, or filesystem paths.
   - Schema:
     ```json
     {
       "error": {
         "code": "INTERNAL_SERVER_ERROR",
         "message": "An unexpected error occurred. Please try again later."
       }
     }
     ```

---

## 4. Security & Privacy Safeguards

1. **Strict CORS Whitelist & Accurate Security Boundaries**:
   - Allowed origins are strictly enumerated (`http://127.0.0.1:5173`, `http://localhost:5173`, `http://127.0.0.1:4173`, `http://localhost:4173`). Wildcard `*` is prohibited. Foreign domains receive no `Access-Control-Allow-Origin` response header.
   - **Crucial Boundary Note on CORS**: Cross-Origin Resource Sharing is a browser-enforced mechanism that relaxes/restricts the Same-Origin Policy (SOP) for client-side scripts. CORS is **not** authentication (it does not authenticate callers, and non-browser clients such as `curl`, Postman, or scripts bypass CORS entirely). Nor is CORS a **complete CSRF defence** (simple cross-origin form submissions or requests that bypass preflight still reach servers; full anti-CSRF protection requires explicit authentication headers, SameSite cookie attributes, and CSRF token verification).
2. **Directory Traversal Immunity**: Session identifiers must conform to `^[a-zA-Z0-9_\-]+$`. The resolved destination directory is verified via `path.is_relative_to(storage_dir)`.
3. **No Static Audio Route**: The `storage/recordings/` folder is never mounted via Starlette `StaticFiles`. Audio bytes can only be retrieved by authenticated service code.
4. **Information Leakage Defense**: Unhandled exceptions are logged with traceback server-side only; clients receive a standardized `INTERNAL_SERVER_ERROR` payload stripped of database strings or filesystem paths.

---

## 5. Audio Recording Upload & Persistence Architecture (Task 2.2)

### A. Container Magic Byte Sniffer (`backend.services.audio_validator`)
To prevent arbitrary file execution and reject malicious non-audio payloads without trusting client headers or extensions, `detect_audio_container` inspects the initial byte sequences:
- **WebM / EBML**: Begins with `\x1a\x45\xdf\xa3`. Returns `audio/webm`.
- **Ogg**: Begins with `OggS` (`\x4f\x67\x67\x53`). Returns `audio/ogg`.
- **WAV**: Bytes 0..4 equal `RIFF` and bytes 8..12 equal `WAVE`. Returns `audio/wav`.
- **MP4 / M4A**: Bytes 4..8 equal `ftyp`. Returns `audio/mp4`.
- Any non-matching payload raises `HTTP 415 Unsupported Media Type` (`UNSUPPORTED_MEDIA_TYPE`).

### B. Atomic Storage Persistence (`backend.services.storage:LocalStorageService`)
1. **Unintended Overwrite Protection**: `has_audio(session_id, take_number)` checks for the existence of previous takes. If found, returns `HTTP 409 Conflict` (`TAKE_ALREADY_EXISTS`).
2. **Atomic Write Replacement**:
   - Payload is initially written to `take_{take_number}.tmp`.
   - Flushed and synced via standard OS file descriptors.
   - Atomically renamed to destination via `os.replace`.
   - Guarantees zero partially-written or corrupt files on power loss or crash.
3. **Information Hiding**: Server returns `{ "file_id": "take_1.webm", "byte_size": ..., "mime_type": ..., "created_at": ... }`. The actual path `storage/recordings/...` is never revealed to the client.

---

## 6. Security Limitations & Production Boundary
1. **No Production Claims**: Authentication, JWT token verification, and persistent session ownership are not yet implemented.
2. **Development-Only Enforcement**: The endpoint rejects requests with `HTTP 403 Forbidden` (`DEVELOPMENT_ONLY_ENDPOINT`) whenever `settings.ENVIRONMENT != "development"`.
3. **Loopback-Only Restriction**: Requests originating from non-loopback addresses (outside `127.0.0.1`, `::1`, `localhost`) are rejected with `HTTP 403 Forbidden` (`FORBIDDEN_ORIGIN`).
4. **Subsequent Milestones**: Authentication, persistent user sessions, and cryptographic ownership authorization will be designed and implemented in subsequent milestone tasks before production deployment.

---

## 7. Speech Transcription Endpoints & Worker Architecture (Task 2.3B)

### A. Endpoints & Flow
1. `POST /api/sessions/{session_id}/recordings/{take_number}/transcribe`:
   - Validates session identifier, take number, and local file existence.
   - Enforces development-only and loopback-only environment guards.
   - Submits job to bounded queue (`TranscriptionWorkerManager`). Returns `202 Accepted` (or `200 OK` if already completed).
   - If bounded queue is full, returns `503 Service Unavailable` (`TRANSCRIPTION_QUEUE_FULL`).
2. `GET /api/sessions/{session_id}/recordings/{take_number}/transcript`:
   - Queries active memory jobs; falls back to loading atomic disk transcript (`transcript_take_{take_number}.json`).
   - Returns structured recognition transcript without exposing filesystem paths.

### B. Worker Durability & Lifecycle
- Single worker loop running continuously in FastAPI lifespan (`app.lifespan`).
- In-memory jobs do not survive server restart; completed disk transcripts do.


