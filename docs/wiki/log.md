# Chronological Wiki Log

This append-only log tracks every ingest, synthesis, and architectural milestone in VERBAMIND.

## [2026-10-11] init | Project Genesis & Toolchain Configuration
- Bootstrapped project repository and verified environment prerequisites (Windows 11, Node v23.3, Python 3.12, uv 0.12).
- Installed and configured BMAD Method skills, Ponytail skill, and Matt Pocock engineering skills (`tdd`, `codebase-design`).
- Established 13-part documentation architecture and initialized the Karpathy LLM Wiki.
- Defined fundamental invariant separating Fluency, Reading Accuracy, Pronunciation, and Answer Relevance.
- Formulated Milestone 1: Voice Capture, Exercise Selection & Playback.

## [2026-10-11] milestone-1 | Voice Capture, Exercise Catalog & Audio Playback Implemented
- Scaffolded React 19 + TypeScript frontend with Vite in `frontend/`.
- Created exercise catalog with difficulty tiers, target WPM guidelines, and placement passages.
- Implemented `useAudioRecorder` hook managing `MediaRecorder` lifecycle, permission errors with address-bar remediation, safety duration cap (180s), and live audio level analysis via Web Audio `AnalyserNode`.
- Built rich dark-mode UI with live animated waveform visualizer, recorder controls, and custom audio player with seek slider and `.webm` file download.
- Authored and verified 15 automated Vitest unit/integration tests covering exercise metadata, recorder state machine, permission denial, and UI components. All 15 passed. Production build verified (`tsc -b && vite build`). Dev server running at `http://127.0.0.1:5173/`.
- User-reported live browser validation confirmed successful execution of exercise selection, recording, pause, resume, stopping, and playback.

## [2026-10-11] task-2.1 | FastAPI Backend Foundation & Private Audio Storage
- Initialized Python backend with `uv` (`pyproject.toml`, `uv.lock`, Python 3.12).
- Designed modular FastAPI app: `backend.core.config` (Pydantic settings), `backend.core.errors` (standardized error JSON without internal trace leaks), `GET /api/health` liveness probe.
- Configured CORS whitelist restricted to exact local frontend origins (`http://127.0.0.1:5173`, `http://localhost:5173`).
- Built private audio storage service (`LocalStorageService`) with directory traversal protection, size caps, and zero public static-file exposure.
- Wired frontend `useBackendStatus` hook and Header connectivity badge (`API Online` / `API Offline`).
- Verified via 10 pytest tests (backend) and 19 vitest tests (frontend). Live HTTP communication verified.
