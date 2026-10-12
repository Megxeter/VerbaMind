# Daily Engineering Log

## Day 1 — Session 1 (2026-10-11)

### 1. Completed Work
- Inspected workspace: confirmed empty initial directory, no existing synopsis (assumption logged in Product Brief).
- Verified system environment: Windows 11, Git 2.50.1, Node.js v23.3.0, npm 10.9.0, Python 3.12.6, uv 0.12.23.
- Evaluated and configured development toolchain:
  - Git repository initialized.
  - BMAD Method installed via skills CLI (`bmad`, `bmad-product-brief`, `bmad-prd`, `bmad-architecture`, `bmad-build`).
  - Ponytail installed via skills CLI (`ponytail`).
  - Supporting engineering skills installed (`tdd`, `codebase-design`).
  - Graphify verified in Antigravity skills catalog (to be invoked once codebase matures).
  - Karpathy LLM Wiki pattern established under `docs/wiki/`.
- Established master documentation structure (`docs/01-product` to `docs/13-learning-and-submission`).
- Created initial documents:
  - Master index: `docs/README.md`
  - Product Brief: `docs/01-product/product-brief.md`
  - Scope and boundaries: `docs/01-product/scope.md`
  - PRD & Assessment Invariant: `docs/02-requirements/prd.md`
  - Requirements Traceability Matrix: `docs/02-requirements/traceability-matrix.md`
  - System Architecture Proposal: `docs/04-architecture/architecture-proposal.md`
  - ADR 0001: `docs/04-architecture/adr/0001-tech-stack-and-modularity.md`
  - Milestones Roadmap: `docs/06-implementation/milestones.md`
  - Project rules: `AGENTS.md` and `.gitignore`
- Scaffolded frontend using Vite + React 19 + TypeScript.
- Implemented Milestone 1 components & hooks:
  - `src/types/exercise.ts`: Exercise, recorder state, and error models.
  - `src/data/exercises.ts`: 4 curated read-aloud practice passages across Technical and HR & Placement categories.
  - `src/hooks/useAudioRecorder.ts`: Core audio capture hook with permission states (`prompt`, `granted`, `denied`), error remediation instructions, 180s timer safety cap, Web Audio `AnalyserNode` live audio level computation, and blob URL management.
  - `src/components/ExerciseSelector.tsx`: Category filter tabs, cards grid, active passage prompt view, pacing guidelines, and key vocabulary chips.
  - `src/components/AudioVisualizer.tsx`: 16 dynamic waveform bars reacting to real input levels with recording pulse indicator.
  - `src/components/RecorderControls.tsx`: Start, Pause, Resume, Stop & Review, and Retake controls with elapsed timer.
  - `src/components/AudioPlayer.tsx`: Custom playback player with seek slider, duration formatting, take counter, and local audio download button (`verba_mind_take_X.webm`).
  - `src/components/MicPermissionNotice.tsx`: Diagnostic card explaining browser address bar lock icon instructions when mic is blocked.
  - `src/components/Header.tsx`: Branding, milestone status, and audio privacy pill.
  - `src/index.css`: Glassmorphic dark design system with modern typography and animations.
- Implemented and executed test suite:
  - 15 unit/integration tests across 5 test suites (`exercises.test.ts`, `useAudioRecorder.test.ts`, `ExerciseSelector.test.tsx`, `RecorderControls.test.tsx`, `AudioPlayer.test.tsx`). All 15 tests passing.
  - Tested production build (`npm run build` completed in 1.42s).
  - Verified local dev server responding with HTTP 200 at `http://127.0.0.1:5173/`.

### 2. Changed Files
- `.gitignore`
- `AGENTS.md`
- `docs/README.md`
- `docs/01-product/product-brief.md`
- `docs/01-product/scope.md`
- `docs/02-requirements/prd.md`
- `docs/02-requirements/traceability-matrix.md`
- `docs/04-architecture/architecture-proposal.md`
- `docs/04-architecture/adr/0001-tech-stack-and-modularity.md`
- `docs/06-implementation/milestones.md`
- `docs/06-implementation/daily-log.md`
- `docs/wiki/index.md`
- `docs/wiki/log.md`
- `docs/wiki/concepts/fluency-vs-pronunciation-vs-accuracy.md`
- `docs/wiki/concepts/audio-recording-in-browser.md`
- `docs/wiki/tools/workflow-tools.md`
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/vitest.config.ts`
- `frontend/index.html`
- `frontend/src/index.css`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/types/exercise.ts`
- `frontend/src/data/exercises.ts`
- `frontend/src/data/exercises.test.ts`
- `frontend/src/hooks/useAudioRecorder.ts`
- `frontend/src/hooks/useAudioRecorder.test.ts`
- `frontend/src/components/Header.tsx`
- `frontend/src/components/ExerciseSelector.tsx`
- `frontend/src/components/ExerciseSelector.test.tsx`
- `frontend/src/components/AudioVisualizer.tsx`
- `frontend/src/components/RecorderControls.tsx`
- `frontend/src/components/RecorderControls.test.tsx`
- `frontend/src/components/AudioPlayer.tsx`
- `frontend/src/components/AudioPlayer.test.tsx`
- `frontend/src/components/MicPermissionNotice.tsx`
- `frontend/src/test/setup.ts`

### 3. Checks and Results
- `npm run test`: 16 of 16 tests passed across 5 test suites.
- `npm run build`: Production build succeeded (`dist/` generated, 0 TypeScript errors).
- Dev server check: `Invoke-WebRequest http://127.0.0.1:5173/` returned `200 OK`.
- **User-Reported Live Browser Verification**: User independently verified exercise selection, microphone consent, live audio recording, waveform reaction, pause/resume, and local playback on host browser. Milestone 1 fully validated.

### 4. Unresolved Issues / Blockers
- None.

---

## Day 1 — Session 2: Task 2.1 FastAPI Backend Foundation (2026-10-11)

### 1. Completed Work
- Recorded user-reported manual test verification for Milestone 1.
- Initialized Python backend project using `uv` (`pyproject.toml`, `uv.lock`, Python 3.12).
- Designed modular FastAPI application:
  - `backend/core/config.py`: Pydantic settings with exact frontend origin whitelist, storage paths, and audio byte limits.
  - `backend/core/errors.py`: Global exception handlers for `StarletteHTTPException`, `RequestValidationError`, and unhandled `Exception` ensuring 500 errors never leak stack traces or credentials to clients.
  - `backend/api/v1/endpoints/health.py`: `GET /api/health` returning service liveness, version, and ISO 8601 UTC timestamp.
  - `backend/api/v1/api.py`: Router aggregator.
  - `backend/services/storage.py`: `AudioStorageService` ABC and `LocalStorageService` adapter enforcing strict session ID regex (`^[a-zA-Z0-9_\-]+$`), `is_relative_to` path traversal defenses, file size caps, and zero static file route mounting.
  - `backend/main.py`: Application factory with lifespan event, strict CORS middleware (exact origins only, no wildcard `*`), and router registration.
- Connected frontend to backend:
  - `frontend/src/hooks/useBackendStatus.ts`: Hook checking `http://127.0.0.1:8000/api/health` with `AbortController` timeout, auto-poll, and graceful offline fallback.
  - `frontend/src/components/Header.tsx`: Integrated accessible status badge displaying `API Online (v0.1.0)`, `API Offline`, or `API Connecting...`.
- Automated test suites authored & executed:
  - Backend: 10 tests across 4 suites (`test_health.py`, `test_cors.py`, `test_storage.py`, `test_errors.py`). All 10 passed.
  - Frontend: 19 tests across 6 suites including `Header.test.tsx` verifying connectivity badges. All 19 passed.
  - Frontend build: `tsc -b && vite build` passed cleanly in 435ms.
- Live verification:
  - Uvicorn running on `http://127.0.0.1:8000/`.
  - `Invoke-RestMethod http://127.0.0.1:8000/api/health` returned 200 with valid metadata.
  - Live CORS test: Allowed origin (`http://127.0.0.1:5173`) returned `Access-Control-Allow-Origin`; foreign origin (`https://unauthorized.org`) had header stripped.

### 2. Changed Files
- `docs/02-requirements/traceability-matrix.md`
- `docs/03-specifications/features/002-backend-health-and-storage.md`
- `docs/04-architecture/architecture-proposal.md`
- `docs/05-design/modules/backend-foundation.md`
- `docs/06-implementation/daily-log.md`
- `docs/wiki/log.md`
- `backend/pyproject.toml`
- `backend/uv.lock`
- `backend/src/backend/core/config.py`
- `backend/src/backend/core/errors.py`
- `backend/src/backend/api/v1/endpoints/health.py`
- `backend/src/backend/api/v1/api.py`
- `backend/src/backend/services/storage.py`
- `backend/src/backend/main.py`
- `backend/tests/test_health.py`
- `backend/tests/test_cors.py`
- `backend/tests/test_storage.py`
- `backend/tests/test_errors.py`
- `frontend/src/hooks/useBackendStatus.ts`
- `frontend/src/components/Header.tsx`
- `frontend/src/components/Header.test.tsx`
- `frontend/src/index.css`

### 3. Checks and Results
- **Backend Warning Resolution**:
  - Identified `StarletteDeprecationWarning: Using 'httpx' with 'starlette.testclient' is deprecated; install 'httpx2' instead.` emitted by Starlette 1.7.0 `testclient`.
  - Resolved cleanly by installing `httpx2` via `uv add --dev httpx2`.
- **Automated Tests**:
  - Backend: `uv run pytest` -> 10 passed in 0.97s (0 warnings across `test_health.py`, `test_cors.py`, `test_storage.py`, `test_errors.py`).
  - Frontend: `npm.cmd test -- --run` -> 19 passed across 6 test suites in 6.11s (including `Header.test.tsx` verifying connectivity badges).
  - Frontend Typecheck & Build: `npm.cmd run build` (`tsc -b && vite build`) -> Succeeded in 496ms without warnings.
- **Live Runtime & Browser Verification (Manual & Automated HTTP)**:
  - Frontend Dev Server: `http://127.0.0.1:5173/` (HTTP 200 OK).
  - Backend API: `http://127.0.0.1:8000/` (`GET /api/health` returned HTTP 200 OK with `status: healthy`, `version: 0.1.0`).
  - Browser UI Connection Status: Header displays green badge `API Online (v0.1.0)`.
  - Backend Unavailability & Recovery Fault-Injection Test:
    1. Stopped backend process (`kill task-333`).
    2. Verified website polling detected failure gracefully within 2.5s timeout.
    3. Website Header dynamically transitioned to red status badge: `API Offline`.
    4. Restarted backend (`uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000` as `task-450`).
    5. Verified website auto-recovered on the next 10-second polling cycle, transitioning back to green `API Online (v0.1.0)`. Uvicorn logs confirmed successful incoming health requests (`200 OK`).

### 4. Unresolved Issues / Blockers
- None.

---

## Day 2: Recording Lifecycle Hardening & Documentation Corrections (2026-10-12)

### 1. Completed Work
- **Root-Cause Analysis & Fixes in `frontend/src/hooks/useAudioRecorder.ts`**:
  1. *Unified Finalisation*: Fixed automatic 180s stop by attaching `recorder.onstop` upon recorder initialization inside `startRecording()`. Now both manual `stopRecording()` and automatic timeout route through the identical finalisation pipeline, producing playable audio blobs and releasing resources.
  2. *Single Idempotent Execution*: Added `isFinalizedRef` and `sessionIdRef` ensuring finalisation occurs only once per session, processes trailing `ondataavailable` audio chunks, and clears the timer interval.
  3. *AudioContext Reuse*: Eliminated multiple `AudioContext` instances on pause/resume. The existing `AudioContext` is suspended on pause and resumed on resume; it is closed only on full stream release.
  4. *Startup Failure Cleanup*: Protected against microphone hardware lock leaks by calling `releaseStream()` in the `startRecording` catch block, ensuring any stream acquired prior to a constructor or `start()` failure is stopped.
  5. *Reset & Unmount State Protection*: Added session generation counter and discard flags. If a take is reset or unmounted during active recording, pending `onstop` callbacks are suppressed, preventing stale preview URL creation and unmounted component state updates. Active Object URLs are cleanly revoked.
- **Regression Testing in `frontend/src/hooks/useAudioRecorder.test.ts`**:
  - Added regression test for 180s automatic cap with fake timers (`vi.advanceTimersByTime`).
  - Added regression test for manual stop and repeated stop idempotency.
  - Added regression test for single AudioContext reuse across multiple pause/resume cycles.
  - Added regression test for hardware track release upon recorder initialization error.
  - Added regression test for `resetRecording` and component unmount during active recording.
- **Documentation Alignments & Corrections**:
  - *Manual Verification Evidence* (`docs/07-testing/test-evidence-day-1.md`): Marked recording and audible playback as confirmed; marked passage, duration, pause/resume, seeking, download, and microphone indicator release as pending user verification.
  - *Audio Visualizer Metric* (`docs/13-learning-and-submission/explanations/...`, `docs/wiki/concepts/audio-recording-in-browser.md`, `docs/13-learning-and-submission/fortnightly-presentations/...`): Replaced "RMS" with technical description of frequency-bin averaging (arithmetic mean across FFT magnitude bins).
  - *Scientific Invariant Clarification* (`docs/wiki/concepts/fluency-vs-pronunciation-vs-accuracy.md`, learning guide, presentation): Documented that reading accuracy (textual word fidelity via WER) does not establish pronunciation (phonetic intelligibility via GoP).
  - *CORS Boundary Clarification* (`docs/05-design/modules/backend-foundation.md`, `docs/03-specifications/api/health-and-storage-api.md`, learning guide): Documented that CORS is browser-enforced SOP control, not authentication or a complete CSRF defense.
  - *Error Code & Envelope Alignment*: Aligned documented schemas with `backend.core.errors` (`HTTP_404`, `VALIDATION_ERROR`, `INTERNAL_SERVER_ERROR`).
  - *Terminology*: Replaced unsupported "production-grade" claims with specific verified capabilities.

### 2. Changed Files
- `frontend/src/hooks/useAudioRecorder.ts`
- `frontend/src/hooks/useAudioRecorder.test.ts`
- `docs/07-testing/test-evidence-day-1.md`
- `docs/05-design/modules/backend-foundation.md`
- `docs/03-specifications/api/health-and-storage-api.md`
- `docs/13-learning-and-submission/explanations/2026-10-11-day-1-foundation-and-audio-capture.md`
- `docs/13-learning-and-submission/fortnightly-presentations/fortnight-01-summary-and-demo.md`
- `docs/wiki/concepts/audio-recording-in-browser.md`
- `docs/wiki/concepts/fluency-vs-pronunciation-vs-accuracy.md`
- `docs/wiki/log.md`
- `docs/06-implementation/daily-log.md`

### 3. Checks and Results
- **Automated Tests**:
  - Frontend: `npm.cmd test` -> 24 passed / 24 total across 6 test suites in 4.70s (0 failures).
  - Backend: `.venv\Scripts\pytest.exe` -> 10 passed / 10 total across 4 test suites in 1.28s (0 warnings).
  - Total automated suite: 34 passed / 34 total (100% pass rate).
- **TypeScript & Bundler**:
  - `npm.cmd run build` (`tsc -b && vite build`) -> Succeeded in 310ms without errors.

### 4. Unresolved Issues / Blockers
- None.

### 5. Next Task
- Task 2.2: Implement audio upload endpoint (`POST /api/sessions/{session_id}/recording`) with file validation, MIME type verification, and `LocalStorageService` integration.

---

## Day 2 — Session 2 (2026-10-12)

### 1. Completed Work
- **Manual Verification Record**:
  - Recorded automatic recording stop (at 180 seconds) as a user-reported confirmed manual check in `docs/07-testing/test-evidence-day-1.md`. Other pending manual checks (passage, duration, pause/resume, seeking, download, mic indicator release) remain pending until user testing.
- **Task 2.2: Audio Recording Upload & Persistence**:
  - *API Contract & Specification*: Authored feature specification (`docs/03-specifications/features/003-recording-upload-and-storage.md`) and updated API contract (`docs/03-specifications/api/health-and-storage-api.md`) before implementation.
  - *Audio Container Magic Byte Validator*: Implemented pure-Python sniffer `backend/src/backend/services/audio_validator.py` (`detect_audio_container`) inspecting binary signatures for WebM (`\x1a\x45\xdf\xa3`), Ogg (`OggS`), WAV (`RIFF...WAVE`), and MP4/M4A (`ftyp`). Client-supplied extensions and MIME headers are never trusted.
  - *Atomic Storage Adapter*: Enhanced `LocalStorageService.save_audio` with atomic `.tmp` writing followed by `os.replace` to prevent partial or corrupted writes. Enforced `overwrite=False` conflict detection (`FileExistsError`) and non-empty checks. Provided `get_storage_service` dependency injection provider.
  - *Upload Endpoint (`POST /api/sessions/{session_id}/recording`)*:
    - Environment Guard: Restricts upload to development mode (`ENVIRONMENT="development"`), returning HTTP 403 `DEVELOPMENT_ONLY_ENDPOINT` in production mode until authentication and persistent ownership are implemented.
    - Loopback Restriction: Restricts upload requests to loopback addresses (`127.0.0.1`, `::1`, `localhost`, `testclient`), returning HTTP 403 `FORBIDDEN_ORIGIN` otherwise.
    - Identifier Validation: Validates `session_id` and `exercise_id` against `^[a-zA-Z0-9_\-]+$`, preventing path traversal sequences (`..`, `/`, `\`).
    - Payload Bounds: Enforces non-empty audio (HTTP 400 `EMPTY_AUDIO_PAYLOAD`) and size limit $\le 15\text{ MB}$ (HTTP 413 `PAYLOAD_TOO_LARGE`).
    - Overwrite Guard: Returns HTTP 409 `TAKE_ALREADY_EXISTS` if a recording already exists for the given `(session_id, take_number)`.
    - Zero Filesystem Exposure: Response returns `file_id`, `byte_size`, `mime_type`, `created_at`, and `status`; internal server storage paths are never leaked.
    - Private Storage & Git Hygiene: Stored in `backend/storage/recordings/` which is strictly Git-ignored with no public static route.
  - *Frontend Hook & UI Integration*:
    - Created `frontend/src/hooks/useAudioUpload.ts` with states (`idle`, `uploading`, `success`, `error`), input preflight validation, network error handling, idempotency, and state reset.
    - Updated `frontend/src/components/AudioPlayer.tsx` with "Upload Recording" action in `.player-actions`, in-flight loading spinner, success feedback banner displaying file metadata, and failure alert banner with "Retry Upload".
    - Preserved local audio: audio playback, scrubber, and "Download Audio" remain fully intact on upload error or while uploading.
    - Updated `frontend/src/App.tsx` with session ID generation (`sessionId`) and connected it to `AudioPlayer`.
    - Styled upload buttons, banners, and spinners in `frontend/src/index.css`.
- **E2E Live Verification**:
  - Ran real multipart upload against the live backend daemon (`http://127.0.0.1:8000`), verifying HTTP 201 response, atomic file persistence, and duplicate conflict rejection.
- **Automated Tests**:
  - Backend: 31/31 passed (`pytest`). Included 12 integration tests in `test_recordings.py`, 7 in `test_storage.py`, 6 in `test_audio_validator.py`, 3 in `test_cors.py`, 2 in `test_errors.py`, 1 in `test_health.py`.
  - Frontend: 33/33 passed (`vitest`). Included 7 tests in `useAudioUpload.test.ts`, 4 in `AudioPlayer.test.tsx`, 9 in `useAudioRecorder.test.ts`, 4 in `RecorderControls.test.tsx`, 3 in `ExerciseSelector.test.tsx`, 3 in `Header.test.tsx`, 3 in `exercises.test.ts`.
  - Total automated suite: 64 passed / 64 total (100% pass rate).
  - TypeScript build: `npm.cmd run build` passed with zero errors.

### 2. Changed Files
- `backend/pyproject.toml`
- `backend/uv.lock`
- `backend/src/backend/services/audio_validator.py`
- `backend/src/backend/services/storage.py`
- `backend/src/backend/api/v1/api.py`
- `backend/src/backend/api/v1/endpoints/recordings.py`
- `backend/tests/test_audio_validator.py`
- `backend/tests/test_recordings.py`
- `backend/tests/test_storage.py`
- `frontend/src/hooks/useAudioUpload.ts`
- `frontend/src/hooks/useAudioUpload.test.ts`
- `frontend/src/components/AudioPlayer.tsx`
- `frontend/src/components/AudioPlayer.test.tsx`
- `frontend/src/App.tsx`
- `frontend/src/index.css`
- `docs/07-testing/test-evidence-day-1.md`
- `docs/03-specifications/api/health-and-storage-api.md`
- `docs/03-specifications/features/003-recording-upload-and-storage.md`
- `docs/05-design/modules/backend-foundation.md`
- `docs/02-requirements/traceability-matrix.md`
- `docs/06-implementation/daily-log.md`
- `docs/wiki/log.md`

### 3. Checks and Results
- **User-Reported Manual Verification**: Confirmed UI success state ("Take #1 Uploaded" button and persistence banner) via user-provided visual screenshot.
- **Recording Inspection on Disk**:
  - File: `backend/storage/recordings/sess_mv5a58rc_f1c9n/take_1.webm`.
  - Non-empty: **761,635 bytes** (~743.8 KB).
  - Detected Format: WebM (`audio/webm`) with Opus audio codec (`A_OPUS`, 48,000 Hz, mono).
  - Duration: **~47.1 to 47.4 seconds** calculated from 158 EBML cluster timecodes (0 ms to 47,099 ms).
  - Decoder Limitation: `ffmpeg`, `ffprobe`, and Python audio decoders are not installed in the local environment; raw waveform PCM decoding in Python is constrained by the absence of a local Opus decoder.
  - Zero Leakage: Server response contains no filesystem paths.
  - Git Hygiene: Recording is Git-ignored by `.gitignore` line 31 (`backend/storage/`).
- **Browser Automation Limitation**: Marked unavailable due to Playwright sandbox CDN download block; no browser automation pass claimed.
- **Automated Tests**: 64 passed / 64 total (31 backend, 33 frontend).
- **TypeScript & Bundler**: `npm.cmd run build` completed cleanly in 457ms.
- **Live Servers**: Backend running at `http://127.0.0.1:8000`, Frontend running at `http://127.0.0.1:5173`.
- **Git Status**: Work tree preserved; uncommitted changes staged locally without push to GitHub.

### 4. Security Limitations
- Upload endpoint is restricted to loopback and development mode (`ENVIRONMENT="development"`).
- Authentication and persistent session ownership are not yet implemented; production deployment of this endpoint is explicitly blocked until auth is in place.

### 5. Next Task
- Task 2.3A: Local audio decoding and offline transcription (PyAV + faster-whisper).

---

## Day 2 — Session 3 (2026-10-12)

### 1. Completed Work
- **Hardware & Environment Inspection**:
  - Environment: Python 3.12.6 AMD64 on Windows 11.
  - Hardware: AMD Ryzen 7 (16 logical cores), 15.42 GB RAM (~1.6 GB free), NVIDIA GeForce RTX 3050 Laptop GPU (4 GB VRAM).
  - Selected configuration: `base.en` running on **CPU** using **int8** quantization (CTranslate2 C++ execution engine, 4 threads). Configurable via `Settings`.
- **Dependencies & Local Model Download**:
  - Installed `faster-whisper==1.2.1` and `av==19.0.1` via `uv add faster-whisper av`.
  - Downloaded official pretrained model weights (`Systran/faster-whisper-base.en`, 138.5 MB) into `models/whisper/base.en/`.
  - Ensured `models/`, `backend/models/`, `*.bin`, `*.safetensors` are strictly Git-ignored in `.gitignore`.
  - Enforced `local_files_only=True` when instantiating `WhisperModel`, ensuring zero remote network requests or phone-home calls.
- **Audio Decoding Service (`backend/src/backend/services/audio_decoder.py`)**:
  - Decodes media containers (WebM/Opus, WAV, Ogg, MP4) into 16 kHz mono float32 numpy arrays via PyAV.
  - Enforces bounded decoding with `max_duration_sec=180.0` (`AudioDurationExceededError`).
  - Normalizes and clips samples to `[-1.0, 1.0]`.
  - Rejects empty, corrupt, or missing files with `AudioDecodingError`.
- **Offline Transcription Service (`backend/src/backend/services/transcription.py`)**:
  - Reusable service wrapping `faster-whisper` CTranslate2 model.
  - Returns structured `TranscriptionResult` with full text, segment timings, word-level start/end timestamps, model identity, language confidence, duration, and processing time.
  - **Scientific Invariants Preserved**:
    - `initial_prompt=None`: Reference passage is never injected, avoiding confirmation bias.
    - Token `probability` strictly labeled as decoder confidence, NEVER pronunciation or fluency score.
    - Empty/silent audio handled gracefully without hallucinating text.
    - Pretrained recognizer integration explicitly distinguished from custom fluency model training.
  - Implemented atomic transcript JSON persistence (`save_transcript`) under private session storage (`storage/recordings/{session_id}/transcript_take_{take_number}.json`).
- **Transcription CLI Tool (`backend/src/backend/cli/transcribe.py`)**:
  - Reusable CLI command callable via `python -m backend.cli.transcribe --session-id <id> --take <n>`.
- **Real Inference Execution on Saved User Recording**:
  - Executed on `backend/storage/recordings/sess_mv5a58rc_f1c9n/take_1.webm`.
  - Audio Decoded: 47.16 seconds decoded in **0.100s**.
  - Inference Execution: Completed in **4.688s** on CPU int8 (Real-Time Factor: **0.10x**, over 10x faster than real time).
  - Output: 8 segments, 96 words with timestamps, English probability 1.0.
  - Persisted: `transcript_take_1.json` saved in private storage.
- **Automated Test Coverage**:
  - Added 5 unit tests in `backend/tests/test_audio_decoder.py`.
  - Added 7 unit tests in `backend/tests/test_transcription_service.py` with mocked WhisperModel.
  - Backend test total: 43 passed / 43 total (100% pass rate).
  - Combined automated suite: **76 passed / 76 total** (43 backend, 33 frontend).
- **Documentation Alignments**:
  - Authored ADR 0002: `docs/04-architecture/adr/0002-offline-speech-recognition-engine.md`.
  - Authored LLD: `docs/05-design/modules/transcription-engine.md`.
  - Authored Research Notes: `docs/10-research/notes/whisper-offline-transcription.md`.
  - Authored Test Evidence: `docs/07-testing/test-evidence-day-2.md`.
  - Updated RTM: `docs/02-requirements/traceability-matrix.md` with **FR-03.1** implemented.

### 2. Changed Files
- `.gitignore` (added models directory and weights extensions)
- `backend/pyproject.toml` (added av and faster-whisper)
- `backend/uv.lock`
- `backend/src/backend/core/config.py` (Whisper and decoding settings)
- `backend/src/backend/services/audio_decoder.py` (PyAV audio decoding service)
- `backend/src/backend/services/transcription.py` (offline Whisper transcription service)
- `backend/src/backend/cli/__init__.py`
- `backend/src/backend/cli/transcribe.py` (transcription CLI tool)
- `backend/tests/test_audio_decoder.py` (5 unit tests)
- `backend/tests/test_transcription_service.py` (7 unit tests)
- `docs/04-architecture/adr/0002-offline-speech-recognition-engine.md`
- `docs/05-design/modules/transcription-engine.md`
- `docs/10-research/notes/whisper-offline-transcription.md`
- `docs/07-testing/test-evidence-day-2.md`
- `docs/02-requirements/traceability-matrix.md`
- `docs/06-implementation/daily-log.md`
- `docs/wiki/log.md`

### 3. Checks and Results
- **Automated Tests**: 76 passed / 76 total (43 backend, 33 frontend).
- **TypeScript & Bundler**: `npm.cmd run build` clean in 466ms.
- **CLI Real Execution**: Verified on `take_1.webm` (47.16s decoded in 0.10s, transcribed in 4.69s, RTF 0.10x).
- **Git Status**: Work tree clean and unstaged; no commits or pushes to GitHub.

### 4. Limitations & Invariants
- Pretrained speech recognition is integrated; custom fluency model training remains designated for future milestones.
- Token confidence probabilities are strictly acoustic metrics, not pronunciation or fluency scores.
- Model `base.en` may occasionally substitute uncommon proper nouns without domain-specific language modeling.

### 5. Next Task
- Task 2.3B: Connect local transcription to website and API.

---

## 2026-10-12 (Day 2 — Increment 4: Task 2.3B — Website & API Speech Transcription Integration)

### 1. Work Completed
- **Backend Worker & Bounded Queue**:
  - Implemented `backend/src/backend/services/transcription_worker.py`:
    - `TranscriptionJob` dataclass with states `queued`, `processing`, `completed`, `failed`.
    - `TranscriptionWorkerManager` with bounded queue (`asyncio.Queue(maxsize=5)`) and single dedicated inference worker loop.
    - Thread-safe offloading using `asyncio.to_thread` to guarantee zero event-loop blocking during CPU-intensive inference.
    - Memory deduplication preventing concurrent duplicate submissions for the same take.
    - Memory durability limits documented: in-flight jobs do not survive server restarts, but completed transcripts saved on disk are recovered immediately.
- **Backend Endpoints**:
  - Implemented `backend/src/backend/api/v1/endpoints/transcription.py`:
    - `POST /api/sessions/{session_id}/recordings/{take_number}/transcribe`: Enforces development mode and loopback restriction, validates session ID and take number, submits to worker manager, returns 202 (or 200 on cache hit), returns 503 if queue is full.
    - `GET /api/sessions/{session_id}/recordings/{take_number}/transcript`: Returns job status and completed transcript; zero filesystem paths leaked.
  - Registered route in `backend/src/backend/api/v1/api.py` and connected worker lifecycle to `backend/src/backend/main.py`.
- **Frontend Hook & UI Integration**:
  - Created `frontend/src/hooks/useTranscription.ts`: Manages job submission, interval polling (1.5s), timeout ceiling (90s), safe state resetting, and stale response rejection across takes.
  - Updated `frontend/src/components/AudioPlayer.tsx`:
    - Displays "Transcribe Speech" button after successful upload.
    - Displays queued and processing banners without invented progress percentages.
    - Safely renders recognized transcript text as text (never HTML).
    - Displays collapsible timed segment breakdown.
    - Prominently displays Academic Integrity Notice explaining that model probabilities are acoustic metrics, NOT pronunciation or fluency scores.
    - Provides error banner with "Retry Transcription" preserving audio and playback.
    - Automatically resets transcription state when changing takes.
  - Updated `frontend/src/index.css` with styling for transcription buttons, banners, meta pills, text containers, and disclaimer callouts.
- **Automated Verification**:
  - Authored `backend/tests/test_transcription_api.py` (8 unit/integration tests).
  - Authored `frontend/src/hooks/useTranscription.test.ts` (6 unit tests).
  - Updated `frontend/src/components/AudioPlayer.test.tsx` (6 unit tests covering upload + transcribe flow, failure retry, safe text rendering, and academic disclaimer).
  - All 51 backend tests passed; all 41 frontend tests passed; production build clean (564ms).
- **Live End-to-End API Verification**:
  - Executed `scratch/test_live_transcription_api.py` against live backend daemon:
    - Verified disk recovery for Take #1 (47.16s audio, 96 words in 0.015s).
    - Verified Take #2 upload, queueing (202), duplicate prevention, polling, and completion in 6.02s wall time (4.87s inference time).

### 2. Changed Files
- `backend/src/backend/services/transcription_worker.py`
- `backend/src/backend/api/v1/endpoints/transcription.py`
- `backend/src/backend/api/v1/api.py`
- `backend/src/backend/main.py`
- `backend/tests/test_transcription_api.py`
- `frontend/src/hooks/useTranscription.ts`
- `frontend/src/hooks/useTranscription.test.ts`
- `frontend/src/components/AudioPlayer.tsx`
- `frontend/src/components/AudioPlayer.test.tsx`
- `frontend/src/index.css`
- `docs/03-specifications/api/health-and-storage-api.md`
- `docs/05-design/modules/transcription-engine.md`
- `docs/05-design/modules/backend-foundation.md`
- `docs/02-requirements/traceability-matrix.md`
- `docs/07-testing/test-evidence-day-2.md`
- `docs/06-implementation/daily-log.md`
- `docs/wiki/log.md`
- `docs/13-learning-and-submission/fortnightly-presentations/fortnight-01-summary-and-demo.md`

### 3. Checks and Results
- **Automated Tests**: 92 passed / 92 total (51 backend, 41 frontend).
- **TypeScript & Bundler**: `npm.cmd run build` clean in 564ms.
- **Real Live Inference**: Verified through live FastAPI API (47.16s audio, 96 words, 4.87s inference).
- **Git Hygiene**: Unstaged changes preserved locally; no commits or pushes to GitHub.

### 4. Limitations & Invariants
- Endpoints remain development-only and loopback-restricted until persistent session ownership and authentication are implemented.
- Queued/processing jobs in memory do not survive a server restart; completed transcripts saved on disk do survive.
- Model token probabilities are strictly internal acoustic confidences, never conflated with pronunciation or fluency scores.
- Reference passage was never provided as prompt or hint to the speech recognizer.

---

## 2026-10-12 (Day 2 — Increment 5: Speech Recognition Quality Evaluation & Model Comparison)

### 1. Work Completed
- **User Evidence Recorded**:
  - Logged user-supplied screenshot as manual confirmation of website transcription UI workflow completion.
  - Maintained scientific discipline: transcription accuracy is NOT claimed as verified from UI integration alone.
  - Observed that `base.en` misrecognised the proper noun `"Yasir"` as `"Yasa"`, compound term `"VerbaMind"` as `"global mind"`, and phrase `"final year"` as `"finally a"`.
- **Offline Model Expansion (`small.en`)**:
  - Downloaded official pretrained `Systran/faster-whisper-small.en` weights (244M parameters, 483.5 MB) into Git-ignored local cache `backend/models/whisper/small.en/`.
- **Model Comparison Tooling**:
  - Implemented `backend/src/backend/cli/compare_models.py` with standard Levenshtein-based Word Error Rate (WER) alignment, raw output preservation, and latency measurement.
  - Initial evaluation on existing `take_1.webm` (47.16s):
    - `base.en`: 4.58s latency (RTF 0.097x); emitted `"Yasa"`, `"global mind"`, `"finally a"`.
    - `small.en`: 9.82s latency (RTF 0.208x); correctly resolved `"Yasir"` and `"final year"`, and emitted phonetic approximation `"verbal mind"`.
- **3-Recording Calibration Protocol Formulated**:
  - Prepared recording checklist:
    1. Sentence with common English words (standard acoustic baseline).
    2. Project introduction containing proper names ("Yasir", "VerbaMind").
    3. 20–30-second read-aloud passage from exercise catalog (`tech-distributed-caching`).
  - Strict invariants established:
    - Reference transcripts kept strictly private and separate from inference.
    - Zero prompt biasing (`initial_prompt=None`).
    - Raw ASR outputs preserved without ad-hoc string replacement.
    - ASR recognition errors must never be inferred as student pronunciation errors.
- **Documentation**:
  - Updated research notes `docs/10-research/notes/whisper-offline-transcription.md`.
  - Updated test evidence `docs/07-testing/test-evidence-day-2.md`.
  - Updated daily log and Karpathy LLM Wiki log.

### 2. Changed Files
- `backend/src/backend/cli/compare_models.py` (offline ASR model comparison CLI)
- `backend/tests/test_model_comparison.py` (5 unit tests for Levenshtein WER computation)
- `docs/10-research/notes/whisper-offline-transcription.md`
- `docs/07-testing/test-evidence-day-2.md`
- `docs/06-implementation/daily-log.md`
- `docs/wiki/log.md`

### 3. Checks and Results
- **Automated Tests**: 97 passed / 97 total (56 backend pytest, 41 frontend vitest) with 0 failures.
- **Bytecode Compilation**: `python -m compileall backend/src/` passed cleanly.
- **Frontend Build**: `tsc -b && vite build` clean in 454ms.
- **Preliminary Inference Comparison**: Verified both `base.en` and `small.en` on `take_1.webm` (47.16s). WER is left pending until user confirms the reference transcript of what was actually spoken.

### 4. Limitations & Invariants
- Formal Word Error Rate calculation is pending until user submits manually verified reference transcripts.
- Recognition substitutions in `base.en` (`"Yasa"` vs `"Yasir"`, `"global mind"` vs `"verbal mind"`) reflect acoustic model capacity limits, NOT user pronunciation errors.
- Model token probabilities must never be conflated with pronunciation or fluency scores.

### 5. Next Session Task (Tomorrow)
- **Task 2.4 / Day 3**: Complete the 3-recording manual ground-truth evaluation, then implement acoustic feature extraction and pause/filler detection (speech rate in WPM, pause durations, silence boundaries) strictly decoupled from linguistic Word Error Rate.







