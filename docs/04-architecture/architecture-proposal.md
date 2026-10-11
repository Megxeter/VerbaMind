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
- **Verdict**: **Approved**.
- **Security Rule**: Audio files must never be placed in a public web root.
- **Implementation**: Stored in a secured local directory (`storage/recordings/`) accessible only through the backend API with ownership verification. An abstracted `StorageBackend` interface will allow swapping to AWS S3 or MinIO if needed.

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
