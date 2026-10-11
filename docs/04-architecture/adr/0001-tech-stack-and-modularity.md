# ADR 0001: Technology Stack Selection & Modular Architecture

## Status
**Accepted** (2026-10-11)

## Context
VERBAMIND is a B.Tech final-year AI/ML project requiring speech audio recording, acoustic signal processing, transcription, machine learning evaluation, and evidence-linked user feedback. The project must be developed over 6 months by a solo student developer working ~5 hours daily.

The system requires:
1. Low-latency, client-side browser recording with reliable permission and error handling.
2. Direct access to Python-based acoustic analysis and AI/ML libraries.
3. Private storage of sensitive user voice recordings.
4. Clean architectural seams so components can be tested and explained during the final viva defense.

## Decision
1. **Frontend**: Vite + React + TypeScript with Vanilla CSS.
   - *Alternative Considered*: Next.js / Full-stack framework.
   - *Why Rejected*: Next.js introduces unnecessary server rendering complexity for client-heavy audio hardware interaction. Vite + React SPA keeps client audio capture simple, isolated, and fast.
2. **Backend**: Python 3.12 + FastAPI, managed by `uv`.
   - *Alternative Considered*: Node.js / Express backend with child Python scripts.
   - *Why Rejected*: Direct Python backend avoids IPC overhead between Node and audio processing libraries (Librosa, PyTorch, Whisper).
3. **Database**: PostgreSQL with SQLite development seam using SQLAlchemy ORM.
   - *Why*: Allows immediate offline development without external database overhead, while guaranteeing production PostgreSQL compatibility.
4. **Audio Storage**: Private file system with abstracted storage interface (`LocalStorage` / `S3Storage`).
   - *Security Guarantee*: Recordings are strictly isolated from the public document root and accessible only via authorized backend streaming endpoints.
5. **Background Task Processing**:
   - Staged approach: In-process asynchronous `BackgroundTasks` for early phases, transitioning to Celery/Redis if worker decoupling is needed in Phase 4.

## Consequences
- **Positive**:
  - Full type safety across frontend and backend.
  - Native Python speech processing pipeline.
  - Minimal tooling friction for local development.
  - Straightforward viva demonstration without multi-container cloud overhead.
- **Negative / Trade-offs**:
  - Long audio processing operations in Stage 1 run within the FastAPI event loop threadpool.
  - Handled by capping recording duration at 3 minutes per take in early releases.
