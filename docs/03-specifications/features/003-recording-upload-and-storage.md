# Feature Specification 003: Browser Recording Upload & Private Storage Persistence

## 1. Context & Scope
Task 2.2 bridges the frontend voice capture studio with the backend private filesystem storage. Users can explicitly upload a completed, locally-verified recording take to the FastAPI service.

In adherence to project constraints:
- Scope is strictly bounded to upload and persistence. No ASR transcription, scoring, or model inference is performed in this task.
- Authentication and persistent session authorization are not yet implemented. This endpoint is strictly restricted to loopback development mode (`ENVIRONMENT="development"`). In non-development mode or non-loopback requests, uploads are rejected with HTTP 403.
- No third-party AI APIs are used.

---

## 2. Technical Specifications

### A. Endpoint Architecture
- **Route**: `POST /api/sessions/{session_id}/recording`
- **Controller**: `backend.api.v1.endpoints.recordings:upload_recording`
- **Request Format**: `multipart/form-data`
- **Path Parameter**: `session_id` (string, `^[a-zA-Z0-9_\-]+$`, 1–64 chars)
- **Form Fields**:
  - `audio`: `UploadFile` (binary audio stream)
  - `exercise_id`: string (`^[a-zA-Z0-9_\-]+$`, 1–64 chars)
  - `take_number`: integer ($\ge 1$, default: 1)

### B. Validation & Security Pipeline
1. **Environment & Host Guard**: Rejects with `403 Forbidden` if `settings.ENVIRONMENT != "development"` or if client host is not loopback (`127.0.0.1`, `::1`, `localhost`, `testclient`).
2. **Identifier Sanitization**: Path traversal sequences (`..`, `/`, `\`) or invalid characters in `session_id` or `exercise_id` return `400 Bad Request`.
3. **Audio Size & Emptiness Bounds**: Empty files (0 bytes) return `400 Bad Request`. Payloads exceeding 15 MB ($15{,}728{,}640$ bytes) return `413 Payload Too Large`.
4. **Header Magic Byte Sniffing**: Does not trust client-supplied extensions or `Content-Type` headers. Sniffs binary header bytes for WebM (`\x1a\x45\xdf\xa3`), Ogg (`OggS`), WAV (`RIFF...WAVE`), and MP4/M4A (`ftyp`). Non-matching files return `415 Unsupported Media Type`.
5. **Overwrite Prevention**: If a take already exists for `(session_id, take_number)`, returns `409 Conflict`.
6. **Atomic Storage Persistence**: Writes to a temporary `.tmp` file before atomically replacing via `os.replace` to prevent partial or corrupted file writes.
7. **Zero Filesystem Exposure**: The client receives a clean metadata response (`file_id: take_1.webm`, `byte_size`, `mime_type`, `created_at`); local server absolute paths are never returned.

---

## 3. Frontend Integration Contract
1. **Upload Trigger**: An "Upload Recording" button renders on the audio player card after a recording is stopped.
2. **Explicit User Action**: Upload runs only upon user click (never automatically).
3. **State Transitions**:
   - `idle`: Upload button active ("Upload to Server").
   - `uploading`: Button disabled with loading indicator; duplicate submissions blocked.
   - `success`: Status badge confirms successful upload with take identifier and byte size; upload button disabled.
   - `error`: Actionable error banner rendered; local audio blob, audio URL, playback, and scrubber remain fully functional so the user never loses their take.

---

## 4. Verification Status & Test Evidence
- **Backend Integration**: 12/12 integration tests passing in `backend/tests/test_recordings.py` (31/31 across backend). Validated empty payload (400), oversized payload (413), invalid container (415), path traversal (400), invalid exercise (400), invalid take number (422), duplicate submission (409), disk write failure (500), production rejection (403), and loopback restriction (403).
- **Frontend Integration**: 11 new tests in `useAudioUpload.test.ts` (7/7) and `AudioPlayer.test.tsx` (4/4) (33/33 across frontend). Validated preflight checks, success feedback, error banners, duplicate click prevention, and local playback preservation on upload failure.
- **Live HTTP E2E Verification**: Verified real multipart upload against running backend server (`201 Created`, atomic file written to `backend/storage/recordings/sess_e2e_live_test/take_1.webm`).
