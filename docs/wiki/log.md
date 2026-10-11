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
