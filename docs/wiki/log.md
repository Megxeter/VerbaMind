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

## [2026-10-12] day-2 | Audio Recording Lifecycle Hardening & Knowledge Base Corrections
- Hardened client-side audio recording engine in `useAudioRecorder.ts`:
  - Connected 180s automatic stop to unified finalisation handler (`recorder.onstop`).
  - Added idempotent single-finalisation guards preserving trailing chunks.
  - Reused single `AudioContext` across pause/resume via `suspend()`/`resume()` without duplicate instances.
  - Added stream track release on recorder startup exception.
  - Suppressed stale asynchronous callbacks on discarded takes or unmount.
- Authored 5 automated regression test cases in `useAudioRecorder.test.ts` (suite total: 24 frontend tests passing).
- Corrected documentation and wiki concepts:
  - Articulated that reading accuracy does not establish pronunciation.
  - Formulated visualizer metric as frequency-bin averaging (not time-domain RMS).
  - Clarified CORS boundaries (SOP relaxation, not authentication or complete CSRF defense).
  - Aligned documented API error codes with implementation (`HTTP_404`, `VALIDATION_ERROR`, `INTERNAL_SERVER_ERROR`).
  - Marked user browser verification accurately (recording & playback confirmed; passage, duration, pause/resume, seeking, download, mic indicator pending).

## [2026-10-12] milestone-2 | Task 2.2: Browser Recording Upload & Private Storage Persistence Implemented
- Authored upload API contract and feature specification (`003-recording-upload-and-storage.md`).
- Implemented pure-Python audio container validator (`audio_validator.py`) detecting binary magic byte signatures for WebM, Ogg, WAV, and MP4/M4A without trusting client headers or extensions.
- Upgraded `LocalStorageService.save_audio` with atomic temporary file replace (`.tmp` -> `os.replace`) to prevent partial writes, and added overwrite conflict protection.
- Implemented `POST /api/sessions/{session_id}/recording` endpoint:
  - Restricted to development mode and loopback client connections (HTTP 403 in production or from remote hosts).
  - Validated session and exercise identifiers against path traversal (`..`, `/`, `\`).
  - Enforced payload bounds ($\le 15$ MB, non-empty) and binary magic byte sniffing.
  - Returns metadata (`file_id`, `byte_size`, `mime_type`, `created_at`, `status`) without exposing filesystem paths.
  - Kept recordings private and Git-ignored without public static routes.
- Built frontend integration:
  - Created `useAudioUpload` hook with state machine (`idle`, `uploading`, `success`, `error`), preflight validation, idempotency, and error recovery.
  - Added "Upload Recording" action in `AudioPlayer` with loading indicator, success banner, and failure alert banner with retry.
  - Preserved local audio playback, scrubber, and download intact on upload failure.
  - Propagated session identifier from `App.tsx`.
- Verification: 31 backend pytest tests passing, 33 frontend vitest tests passing (64/64 total), clean production build.

## [2026-10-12] milestone-2 | Task 2.3A: Local Audio Decoding & Offline Speech Transcription Implemented
- Selected and verified local speech recognition runtime: `faster-whisper` (CTranslate2 C++ execution engine) using `base.en` on CPU with `int8` quantization (4 threads).
- Downloaded official pretrained model weights from `Systran/faster-whisper-base.en` into Git-ignored local directory `models/whisper/base.en/` (138.5 MB).
- Implemented `backend.services.audio_decoder`: local audio decoding via PyAV (`av==19.0.1`), downmixing to 16 kHz mono float32 with bounded duration cap ($\le 180$s).
- Implemented `backend.services.transcription`: offline speech-to-text service extracting segment and word-level timestamps, enforcing `initial_prompt=None` (zero passage biasing), and saving atomic JSON transcripts.
- Maintained scientific invariants: token confidence probabilities strictly labeled as acoustic probabilities (never pronunciation or fluency scores); explicitly noted that custom fluency model training remains future work.
- Built CLI tool `backend.cli.transcribe`: verified real inference on uploaded recording `take_1.webm` (47.16s audio decoded in 0.10s, transcribed in 4.69s, RTF 0.10x, 96 words with timestamps).
- Authored 12 unit tests across `test_audio_decoder.py` and `test_transcription_service.py` (total 43 backend tests, 76 combined project tests passing).
- Authored ADR 0002, LLD `transcription-engine.md`, research notes `whisper-offline-transcription.md`, and test evidence `test-evidence-day-2.md`.

## [2026-10-12] milestone-2 | Task 2.3B: Connected Speech Transcription API & Website UI Implemented
- Designed and implemented asynchronous transcription worker `TranscriptionWorkerManager` with bounded queue (`maxsize=5`) and dedicated background consumer loop running off FastAPI's async event loop via `asyncio.to_thread`.
- Built API endpoints `POST /api/sessions/{session_id}/recordings/{take_number}/transcribe` and `GET .../transcript`:
  - Enforced loopback and development guards (HTTP 403 in production or external hosts).
  - Implemented deduplication returning active jobs for identical in-flight submissions.
  - Returns structured recognition transcript (text, word timestamps, latency, model identity) with zero filesystem path exposure.
  - Explicitly documented restart limits: in-flight jobs in memory do not survive server restart; completed transcripts saved atomically on disk do.
- Built frontend integration:
  - Created `useTranscription` hook with polling state machine, stale take rejection, and clean reset.
  - Updated `AudioPlayer` component with "Transcribe Speech" action after upload, in-progress banner without fake percentages, safe plain-text rendering, collapsible timed segments viewer, and Academic Integrity Notice.
  - Preserved recording playback and download options on transcription failure with retry capability.
- Verification:
  - 51 backend tests passing (including 8 new API/worker tests).
  - 41 frontend tests passing (including 6 new hook tests and 6 player integration tests).
  - Total 92 passing automated tests; clean production build (564ms).
  - Live E2E test verified against running server: 47.16s audio recognized in 4.87s inference latency (6.02s wall time), zero path leaks.

## [2026-10-12] milestone-2 | Speech Recognition Quality Evaluation & Local Model Comparison (base.en vs small.en)
- Recorded user manual evidence confirming website transcription UI flow completion (accuracy not claimed as verified).
- Evaluated proper-noun and phonetic substitutions in `base.en` output (`"Yasa"`, `"global mind"`, `"finally a"`).
- Downloaded official `small.en` CTranslate2 model weights (483.5 MB, 244M params) into local cache.
- Built comparison CLI `compare_models.py` with Levenshtein Word Error Rate (WER) alignment.
- Compared `base.en` vs `small.en` on user recording (`take_1.webm`):
  - `base.en`: 4.58s CPU inference (RTF 0.097x); emitted substitutions.
  - `small.en`: 9.82s CPU inference (RTF 0.208x); successfully resolved `"Yasir"` and `"final year"`, and emitted phonetic approximation `"verbal mind"`.
- Established strict academic protocol: reference transcripts kept private and separated from inference; zero prompt biasing; ASR recognition errors must never be inferred as pronunciation defects.





