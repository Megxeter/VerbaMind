# Test Evidence & Verification Report — Day 1 (2026-10-11)

**Project**: VERBAMIND  
**Milestones Covered**: Milestone 1 (Audio Capture & Playback) & Task 2.1 (FastAPI Foundation & Health)  
**Execution Environment**: Windows 11, Node.js v23.3.0, Python 3.12.6, uv 0.12.23  

---

## 1. Summary of Verification Activities

To maintain scientific integrity and academic rigor, test evidence is strictly categorized by verification tier:

1. **Automated Unit & Integration Tests**: Executed by headless test runners (`pytest`, `vitest`).
2. **Automated Static & Compilation Checks**: Verified by `tsc -b` and `vite build`.
3. **Live Runtime & Fault-Injection Checks**: Verified via HTTP probes and controlled daemon restarts.
4. **User-Reported Browser Checks**: Manually tested in the browser for hardware and audio sanity.

---

## 2. Automated Test Results

### 2.1 Backend Pytest Suite
- **Command**: `uv run pytest`
- **Duration**: 0.97s
- **Pass Rate**: 10 passed / 10 total (100%)
- **Warnings**: 0 (Resolved previous `StarletteDeprecationWarning` via `httpx2`).

| Test Suite | Test Case | Assertion / Invariant Verified | Result |
| :--- | :--- | :--- | :--- |
| `tests/test_health.py` | `test_health_check_returns_healthy` | Returns HTTP 200, status `"healthy"`, valid ISO 8601 UTC timestamp | **PASS** |
| `tests/test_cors.py` | `test_cors_allowed_origin` | Whitelisted origin `http://127.0.0.1:5173` receives `Access-Control-Allow-Origin` | **PASS** |
| `tests/test_cors.py` | `test_cors_disallowed_origin` | Unauthorized origin receives no CORS headers | **PASS** |
| `tests/test_cors.py` | `test_cors_preflight_options` | Preflight `OPTIONS` request succeeds for allowed origin | **PASS** |
| `tests/test_storage.py` | `test_store_audio_success` | Valid audio bytes written to private disk path under session folder | **PASS** |
| `tests/test_storage.py` | `test_path_traversal_rejected` | Malicious session IDs (`../../etc`) raise `ValueError` | **PASS** |
| `tests/test_storage.py` | `test_invalid_session_id_chars` | Session IDs with illegal characters raise `ValueError` | **PASS** |
| `tests/test_storage.py` | `test_file_size_limit_exceeded` | Payloads exceeding 15 MB limit raise `ValueError` | **PASS** |
| `tests/test_errors.py` | `test_404_not_found_structure` | Non-existent route returns sanitized `RESOURCE_NOT_FOUND` JSON | **PASS** |
| `tests/test_errors.py` | `test_422_validation_error_structure`| Invalid request payload returns structured validation details | **PASS** |

### 2.2 Frontend Vitest Suite
- **Command**: `npm.cmd test -- --run`
- **Duration**: 6.11s
- **Pass Rate**: 19 passed / 19 total (100%)

| Test Suite | Tests | Invariants Verified | Result |
| :--- | :--- | :--- | :--- |
| `src/data/exercises.test.ts` | 3 | Passage structure, unique IDs, WPM target boundaries | **PASS** |
| `src/hooks/useAudioRecorder.test.ts` | 4 | Initial state, permission denial handling, duration tick, track stop cleanup | **PASS** |
| `src/components/Header.test.tsx` | 3 | API Connecting, Online (`v0.1.0`), and Offline status badge rendering | **PASS** |
| `src/components/AudioPlayer.test.tsx` | 2 | Audio playback card mounting, take metadata display, scrub controls | **PASS** |
| `src/components/RecorderControls.test.tsx` | 4 | Start/Pause/Resume/Stop button state transitions | **PASS** |
| `src/components/ExerciseSelector.test.tsx` | 3 | Category filtering, exercise card selection callback | **PASS** |

### 2.3 Static Analysis & Production Build
- **Command**: `npm.cmd run build` (`tsc -b && vite build`)
- **Duration**: 496ms
- **Result**: **SUCCESS**.
- **Output Artifacts**:
  - `dist/index.html` (0.72 kB)
  - `dist/assets/index-CCXaHi80.css` (14.89 kB, gzip: 3.66 kB)
  - `dist/assets/index-BfKztpn4.js` (250.85 kB, gzip: 78.39 kB)

---

## 3. Live Runtime & Fault-Injection Checks

### 3.1 Live Service Reachability
- Frontend: `curl.exe -I http://127.0.0.1:5173/` -> `HTTP/1.1 200 OK`.
- Backend Health Probe:
  ```powershell
  Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -Method Get
  ```
  Returns:
  ```json
  {"status":"healthy","service":"verbamind-api","version":"0.1.0","timestamp":"2026-10-11T17:38:30.282617+00:00","environment":"development"}
  ```

### 3.2 Live Backend Unavailability & Auto-Recovery
- **Test Sequence**:
  1. Frontend running in browser with green `● API Online (v0.1.0)` badge.
  2. Killed running backend process (`uvicorn`).
  3. Frontend periodic health poller encountered connection refusal.
  4. Header status badge dynamically transitioned to red `● API Offline` without uncaught UI exceptions.
  5. Restarted backend daemon on port 8000.
  6. On the subsequent 10s polling interval, health probe succeeded.
  7. Header badge automatically transitioned back to green `● API Online (v0.1.0)`.

---

## 4. User-Reported Browser Checks (Milestone 1 Voice Capture)

Following rigorous verification guidelines, manual checks are partitioned into confirmed and pending statuses:

### Confirmed Manual Checks
- **Microphone Capture / Recording**: **CONFIRMED** — Browser acquired microphone consent and successfully streamed user audio chunks into `MediaRecorder`.
- **Audible Playback**: **CONFIRMED** — Browser preview player successfully mounted and played back captured speech with audible clarity.
- **Automatic Recording Stop (180s Safety Cap)**: **CONFIRMED** — User verified live that reaching the recording duration safety cap automatically finalizes the take and produces playable audio.

### Pending User Verification (Scheduled for Follow-Up Manual Test)
- **Exercise Passage Pacing / Selection**: **PENDING** — Selection of specific passage ("Distributed Caching") and verification of WPM target calculation.
- **Pause & Resume Controls**: **PENDING** — Manual interaction toggling pause and resuming voice take in browser.
- **Player Scrubber Seeking**: **PENDING** — Scrubbing audio playback head across different timestamps.
- **Local WebM Download**: **PENDING** — Clicking download button and validating saved `.webm` Opus container in external media player.
- **Microphone Hardware Indicator Release**: **PENDING** — Verifying operating system / browser tab recording dot immediately turns off upon clicking Stop.

---

## 5. Day 2 Automated Regression Test Evidence (2026-10-12)

### 5.1 Lifecycle Fixes in `useAudioRecorder.ts`
To resolve critical recording lifecycle issues prior to building upload endpoints:
1. **Automatic vs Manual Finalisation**: Attached `recorder.onstop` at recorder initialization inside `startRecording()`. Both automatic duration stop (180s cap) and manual `stopRecording()` route through the identical finalisation pipeline, producing playable Object URLs and releasing resources.
2. **Idempotent Single Finalisation**: Added `isFinalizedRef` and `sessionIdRef` ensuring finalisation occurs exactly once per take, preserves final `ondataavailable` chunks, and clears the timer interval.
3. **AudioContext Reuse**: Replaced multi-instance instantiation on pause/resume with a single `AudioContext` that suspends on pause and resumes on resume.
4. **Startup Error Resource Release**: Added cleanup in `startRecording` catch block so any microphone stream acquired before constructor/start exceptions is immediately closed.
5. **Reset / Unmount State Protection**: Suppressed stale `onstop` callbacks on discarded takes or unmounted components, revoking Object URLs and releasing hardware tracks.

### 5.2 Frontend Vitest Regression Suite
- **Command**: `npm.cmd test`
- **Result**: **24 passed / 24 total across 6 test suites (100% PASS)**
- **Regression Tests in `src/hooks/useAudioRecorder.test.ts`**:
  - `automatically finalizes recording and releases resources at the 180s limit`: **PASS** (fake timers verify auto-stop, track stop, audio blob generation).
  - `handles manual stop and repeated stop gracefully`: **PASS** (resolves blob, idempotent on repeated invocations).
  - `reuses the existing AudioContext during pause and resume without creating duplicate instances`: **PASS** (single AudioContext lifecycle across repeated pause/resume cycles).
  - `releases acquired microphone tracks if recorder startup throws an error`: **PASS** (tracks stopped when recorder initialization throws).
  - `discards recording on resetRecording without creating a preview or updating to stopped`: **PASS** (status resets to ready, blob is null).
  - `cleans up resources and suppresses discarded callbacks on unmount during active recording`: **PASS** (hardware tracks stopped, close called, no URL leaks).

### 5.3 Combined Project Test Totals
- **Frontend**: 24 tests passed (6 test files)
- **Backend**: 10 tests passed (4 test files)
- **Total Automated Tests**: 34 passed / 34 total (100% pass rate)
- **Static Analysis & Build**: `npm.cmd run build` passed cleanly in 310ms.

---

## 6. Task 2.2 Recording Upload & Persistence Verification Evidence (2026-10-12)

### 6.1 User-Reported Manual Evidence: UI Success State
- **User Evidence**: User supplied visual confirmation / screenshot verifying:
  - "Take #1 Uploaded" button state displayed.
  - Green confirmation banner displayed: *Take #1 Persisted Locally (`take_1.webm`) under session `sess_mv5a58rc_f1c9n`*.
  - Status confirmed as **MANUAL CHECK PASSED (UI Success State)**.

### 6.2 Backend Private Storage & Container Inspection
- **Disk Existence**: Confirmed file exists at server-controlled path:
  `backend/storage/recordings/sess_mv5a58rc_f1c9n/take_1.webm`.
- **Payload Non-Emptiness**: Byte size on disk is **761,635 bytes** (~743.8 KB), confirming substantive audio capture.
- **Container Format**: WebM (`audio/webm`), EBML Header with DocType `webm`, MuxingApp `Chrome`.
- **Audio Codec**: Opus (`A_OPUS`, 48,000 Hz, mono, `OpusHead`).
- **Detected Audio Duration**:
  - Parsed 158 EBML clusters spanning timestamp 0 ms to 47,099 ms.
  - Actual audio duration calculated from packet timecodes: **~47.1 to 47.4 seconds** (~0:47).
- **Local Decoder Limitation**:
  - *Note on Decoder Availability*: Neither `ffmpeg`, `ffprobe`, nor Python audio decoding libraries (`mutagen`, `soundfile`, `librosa`) are installed in the system PATH or virtual environment.
  - In accordance with academic and scientific integrity standards, full acoustic waveform decoding / sample playback inside the local backend Python environment is constrained by the absence of a local Opus decoder binary.

### 6.3 Security, Privacy & Git Hygiene Checks
- **Zero Filesystem Path Exposure**: Verified response payload contains:
  `{"session_id": "sess_mv5a58rc_f1c9n", "exercise_id": "tech-distributed-caching", "take_number": 1, "file_id": "take_1.webm", "byte_size": 761635, "mime_type": "audio/webm", "created_at": "...", "status": "uploaded"}`.
  No server drive letters, absolute directories, or filesystem hierarchies are revealed.
- **Git Exclusion**: Confirmed via `git check-ignore -v backend/storage/recordings/sess_mv5a58rc_f1c9n/take_1.webm` that the recording is ignored by line 31 of `.gitignore` (`backend/storage/`). No audio files are tracked or staged.
- **No Static Route**: The storage directory is not exposed as a static web path.

### 6.4 Browser Automation Status
- **Status**: **UNAVAILABLE / NOT RUN**.
- **Reason**: Playwright driver binary installation from Microsoft Azure CDN failed with HTTP 404 due to offline sandbox restrictions.
- **Accreditation**: No automated browser verification pass is claimed. Manual user verification was used exclusively for browser validation.

### 6.5 Automated Test Suite Totals (Post Task 2.2)
- **Backend (`pytest`)**: 31 passed / 31 total (100% pass rate).
- **Frontend (`vitest`)**: 33 passed / 33 total (100% pass rate).
- **Combined Automated Tests**: **64 passed / 64 total** across 13 test suites.
- **TypeScript Production Build**: Succeeded (`tsc -b && vite build`) in 457ms.


