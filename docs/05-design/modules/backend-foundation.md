# Module Low-Level Design: Backend Foundation & Audio Storage (LLD)

**Module**: `backend.core` & `backend.services.storage`  
**Phase**: Milestone 2 — Task 2.1  
**Status**: Implemented & Verified  

---

## 1. Module Responsibilities & Seams

In accordance with our codebase design principles, the backend foundation isolates configuration, errors, and audio persistence behind deep seams with minimal surface area.

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
│ `AudioStorage       │ `LocalStorageService`    │ Path sanitization,    │
│  Service` (ABC)     │ (`services.storage`)     │ size checks, private  │
│                     │                          │ ACLs, no static routes│
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ `useBackendStatus`  │ React Hook               │ Auto-ping with abort  │
│                     │ (`frontend/src/hooks`)   │ timeout & offline UI  │
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

## 3. Security & Privacy Safeguards
1. **No CORS Wildcards**: Allowed origins are strictly enumerated (`http://127.0.0.1:5173`, `http://localhost:5173`, `http://127.0.0.1:4173`, `http://localhost:4173`). Foreign domains receive no `Access-Control-Allow-Origin` response header.
2. **Directory Traversal Immunity**: Session identifiers must conform to `^[a-zA-Z0-9_\-]+$`. The resolved destination directory is verified via `path.is_relative_to(storage_dir)`.
3. **No Static Audio Route**: The `storage/recordings/` folder is never mounted via Starlette `StaticFiles`. Audio bytes can only be retrieved by authenticated service code.
4. **Information Leakage Defense**: Unhandled exceptions are logged with traceback server-side only; clients receive a standardized `INTERNAL_SERVER_ERROR` payload stripped of database strings or filesystem paths.
