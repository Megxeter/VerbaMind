# VERBAMIND API Specification: Health Probe & Private Audio Storage

**Version**: `0.1.0`  
**Base URL**: `http://127.0.0.1:8000/api`  
**Status**: Implemented (`/api/health`), Specification Phase (`/api/sessions/{session_id}/recording`)

---

## 1. Global Policies

### 1.1 CORS Policy
Cross-Origin Resource Sharing is strictly constrained to prevent CSRF and cross-origin audio data extraction.
- **Allowed Origins**:
  - `http://127.0.0.1:5173` (Vite dev server)
  - `http://localhost:5173`
  - `http://127.0.0.1:4173` (Vite preview server)
  - `http://localhost:4173`
- **Wildcards**: `*` is explicitly prohibited.
- **Allowed Methods**: `GET`, `POST`, `OPTIONS`.
- **Allowed Headers**: `Content-Type`, `Authorization`.

### 1.2 Error Envelope Standard
All application errors return a structured JSON object adhering to this schema:

```json
{
  "detail": "Descriptive, client-safe error message",
  "error_code": "RESOURCE_NOT_FOUND | VALIDATION_ERROR | INTERNAL_SERVER_ERROR",
  "timestamp": "2026-10-11T17:30:54.271773+00:00"
}
```
*Note: Unhandled 500 internal server errors log the traceback on the server but strip all exception details, database connection strings, and file system paths from the client response.*

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

### 2.2 Audio Recording Upload (Upcoming — Task 2.2)
Accepts user speech recording for a practice session and persists it into the private storage layer.

- **Method**: `POST`
- **Path**: `/api/sessions/{session_id}/recording`
- **Content-Type**: `multipart/form-data`
- **Path Parameters**:
  - `session_id` (`string`, regex: `^[a-zA-Z0-9_\-]+$`): Unique session identifier. Path traversal characters (`..`, `/`, `\`) are rejected with `400 Bad Request`.
- **Form Fields**:
  - `audio` (`UploadFile`, binary): Audio file payload.
  - `exercise_id` (`string`, required): Practice passage ID being attempted.
  - `take_number` (`integer`, optional, default: 1): Practice attempt counter.
- **Validation Constraints**:
  - Max file size: 15 MB (15,728,640 bytes). Exceeding uploads return `413 Request Entity Too Large`.
  - Allowed MIME types: `audio/webm`, `audio/webm;codecs=opus`, `audio/wav`, `audio/mp4`.
- **Planned 201 Created Response**:
  ```json
  {
    "session_id": "session_abc123",
    "file_id": "take_1.webm",
    "byte_size": 284192,
    "stored_at": "2026-10-11T17:45:00.000000+00:00",
    "status": "uploaded"
  }
  ```
