# System Architecture Proposal — VERBAMIND

## 1. System Overview
VERBAMIND follows a modular client-server architecture designed for high reliability, clear code seams, and straightforward student project maintenance.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (BROWSER)                          │
│                                                                        │
│   React + TypeScript Web Application (Vite, Strict Typing, Vanilla CSS)│
│                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │ Exercise Selection UI   │  │ MediaRecorder + Web Audio Engine    │  │
│  │ (Read-Aloud & Topics)   │  │ (Waveform, Timer, Permission State) │  │
│  └─────────────────────────┘  └──────────────────┬──────────────────┘  │
│                                                  │ Audio Blob (WebM)   │
└──────────────────────────────────────────────────┼─────────────────────┘
                                                   │ HTTPS Upload
                                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SERVER LAYER (FASTAPI)                           │
│                                                                        │
│   Python 3.12 + FastAPI Async REST API (uv-managed)                    │
│                                                                        │
│  ┌────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ API Endpoints (Auth, Sessions, │  │ Audio Storage Manager        │  │
│  │  Exercises, Submissions)       │  │ (Private disk / Object store)│  │
│  └───────────────┬────────────────┘  └──────────────┬───────────────┘  │
│                  │                                  │                  │
│                  ▼                                  ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Speech Processing & Analysis Pipeline (Async Background Worker)   │  │
│  │                                                                  │  │
│  │  [ Whisper STT ] ──> Word Timestamps (start/end)                 │  │
│  │  [ Librosa / PyAudioAnalysis ] ──> Pitch, Energy, Pause Density  │  │
│  │  [ Custom Fluency Scorer ] ──> Rhythm & Hesitation Evaluation    │  │
│  │  [ Reading Accuracy Engine ] ──> Levenshtein WER Alignment       │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          PERSISTENCE LAYER                             │
│                                                                        │
│  • PostgreSQL / SQLite (Users, Sessions, Acoustic Metrics, Transcripts)│
│  • Private Audio Filesystem (`storage/recordings/{session_id}/`)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Review of Proposed Technology Stack

### A. Frontend: React + TypeScript (Vite)
- **Verdict**: **Approved**.
- **Rationale**: Strict TypeScript guarantees type safety between frontend data models and backend Pydantic schemas. Vite provides instantaneous HMR (Hot Module Replacement) and fast build times.
- **Audio Interface**: Leverages native browser `navigator.mediaDevices.getUserMedia` and `MediaRecorder` APIs with clean state machine modeling.
- **Styling**: Rich, modern Vanilla CSS design system with custom properties, glassmorphism, responsive grid, and smooth micro-animations.

### B. Backend: Python FastAPI (uv managed)
- **Verdict**: **Approved**.
- **Rationale**: Python is mandatory for speech processing (Librosa, Whisper, SoundFile, Torch, Scikit-learn). FastAPI offers async request handling, auto-generated OpenAPI documentation, and strict Pydantic validation.
- **Dependency Management**: `uv` provides blazing-fast virtual environment creation and package resolution.

### C. Database: PostgreSQL with SQLite Dev Fallback
- **Verdict**: **Approved with local SQLite development seam**.
- **Rationale**: For production and final submission, PostgreSQL handles relational data (users, exercises, attempts, word tokens) robustly. For local initial development, a SQLAlchemy / SQLModel repository pattern enables zero-friction SQLite testing without requiring a running Docker or Postgres service immediately.

### D. Private Audio Storage
- **Verdict**: **Approved & Implemented (Task 2.1)**.
- **Security Rule**: Audio files must never be placed in a public web root.
- **Implementation**: Stored in a secured local directory (`storage/recordings/`) outside the public web root. `LocalStorageService` implements the `AudioStorageService` interface with directory traversal defenses (`is_relative_to` and strict session ID regex validation). The storage directory is strictly unmounted from static-file serving. Future cloud object storage (S3/MinIO) can be introduced via another adapter without altering domain callers.

### E. Background Analysis Worker
- **Verdict**: **Approved with staged implementation**.
- **Staging Strategy**:
  - **Stage 1 (Phases 1-2)**: FastAPI `BackgroundTasks` within the application process. Keeps the setup simple, avoids external Redis dependency, and runs speech extraction asynchronously without blocking HTTP response returns.
  - **Stage 2 (Phases 3-4)**: If concurrent processing bottlenecks arise during ML inference, extract the worker into Celery / Redis or ARQ without changing the REST API contracts.

---

## 3. Modular Boundaries
- **Module 1 (`audio-engine`)**: Client-side recording, permissions, audio format validation, timer, and playback.
- **Module 2 (`exercise-catalog`)**: Structured passages, word counts, difficulty tiers, and guidance.
- **Module 3 (`api-gateway`)**: Request routing, session authentication, and payload validation.
- **Module 4 (`speech-analytics`)**: Decoupled sub-engines for:
  - `AcousticEngine` (WPM, pauses, pitch, energy)
  - `TranscriptEngine` (Whisper ASR with word timestamps)
  - `AccuracyEngine` (Text comparison and alignment)
  - `FluencyModel` (Trained scoring model evaluated on unseen speakers)
- **Module 5 (`comparison-engine`)**: Delta calculation between attempt $N$ and attempt $N+1$.

---

## 4. Implementation Status (Milestone 1 & Task 2.1)

### A. Completed Work
1. **Frontend Voice Recording Studio & Audio Player**:
   - `MediaRecorder` audio capture with WebM Opus encoding and 180s duration limit.
   - Web Audio API real-time `AnalyserNode` input metering (16-bar animated waveform visualizer).
   - Audio track lifecycle management with explicit hardware stream release (`track.stop()`).
   - Exercise catalog (4 technical & HR passages with difficulty tiers and target WPM metrics).
   - Client-side audio preview player with scrub timeline and local file download.
   - 19 automated frontend unit/component tests in Vitest passing.
2. **Backend API Foundation & Health Probe**:
   - Python 3.12 / FastAPI application initialized and managed via `uv` lockfile.
   - Centralized typed configuration (`Pydantic BaseSettings`) with strict CORS origin whitelist.
   - Global exception handling stripping stack traces and sensitive error details from 500 responses.
   - Health diagnostic probe (`GET /api/health`) returning ISO 8601 UTC timestamp and metadata.
   - Frontend connectivity status badge with auto-polling and offline fault detection.
   - 10 automated backend tests in Pytest passing with 0 warnings.
3. **Private Audio Storage Abstraction**:
   - `AudioStorageService` ABC and concrete `LocalStorageService` adapter.
   - Path traversal defenses (`path.is_relative_to` and strict regex session validation `^[a-zA-Z0-9_\-]+$`).
   - Zero static-file route exposure.

### B. Pending Work (Next Milestones)
1. **Task 2.2**: Audio upload endpoint (`POST /api/sessions/{session_id}/recording`) with multipart/form-data validation, MIME sniffing, and storage persistence.
2. **Task 2.3**: Speech-to-Text pipeline integration with OpenAI Whisper (local execution producing word-level start/end timestamps).
3. **Task 2.4 / Milestone 3**: Acoustic feature extraction (WPM, pause density, pitch variation via Librosa) and reading accuracy scoring (Levenshtein WER alignment).
4. **Milestone 4**: Interactive timestamp-linked transcript and retry comparison analytics.
5. **Milestone 5**: Custom fluency ML scoring model trained and evaluated on unseen speakers.

### C. Blocked Work
- **None currently**. All prerequisites for Task 2.2 audio upload are satisfied.

