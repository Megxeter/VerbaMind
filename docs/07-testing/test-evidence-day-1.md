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

The student completed manual hardware testing in Google Chrome on Windows 11:
- **Exercise Selection**: Selected "Explaining Distributed Caching & Invalidation"; guidance and target pacing rendered properly.
- **Microphone Permission**: Browser prompt triggered; granted permission without issue.
- **Recording**: Captured 45 seconds of speech; visualizer bars animated smoothly with voice volume.
- **Controls**: Pause, resume, and stop buttons functioned as expected.
- **Playback & Scrubber**: Listened to audio take without jitter or distortion; seeking worked smoothly.
- **Download**: Triggered `.webm` file download; local Opus audio file played correctly in external media player.
- **Microphone Hardware Release**: Browser recording dot disappeared immediately upon clicking "Stop & Review".
