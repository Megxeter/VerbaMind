# Feature Specification 002: Backend Health Check & Private Audio Storage

## 1. Context
Task 2.1 establishes the initial backend communication and storage foundation for VERBAMIND. Before accepting audio payloads or executing CPU-intensive transcription workers in subsequent tasks, the system requires a verifiable service health probe, strict CORS boundaries, and an unexposed private storage abstraction.

---

## 2. Technical Specifications

### A. Backend Architecture
- **Framework**: FastAPI `>= 0.115` on Python `3.12+` managed via `uv`.
- **Packaging**: Managed under `backend/pyproject.toml` with reproducible lockfile `backend/uv.lock`.
- **Application Factory**: `backend.main:create_application()`
- **Server Entrypoint**: `uvicorn backend.main:app`

### B. Health Probe Contract
- **Endpoint**: `GET /api/health`
- **Headers Required**: None.
- **Success Response**: HTTP 200 with JSON payload containing:
  - `status`: String `"healthy"`
  - `service`: String `"verbamind-api"`
  - `version`: SemVer string matching package version
  - `timestamp`: UTC ISO 8601 string
  - `environment`: String `"development"` | `"production"`

### C. CORS Policy Specification
- Allowed Origins:
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`
  - `http://127.0.0.1:4173`
  - `http://localhost:4173`
- Disallowed Origins: Receive standard HTTP response lacking the `Access-Control-Allow-Origin` header, causing browser Fetch API calls to be blocked at the client sandbox boundary.

### D. Private Audio Storage Contract
- **Class**: `LocalStorageService(AudioStorageService)`
- **Methods**:
  - `save_audio(session_id, take_number, data, mime_type) -> Path`
  - `get_audio_path(session_id, take_number) -> Optional[Path]`
  - `delete_audio(session_id, take_number) -> bool`
  - `has_audio(session_id, take_number) -> bool`
- **Validation Rules**:
  - `session_id` must match `^[a-zA-Z0-9_\-]+$`
  - `len(data) <= 15 * 1024 * 1024` (15 MB)
  - `take_number >= 1`
  - Resulting file path must resolve strictly within `storage/recordings/`
