# Test Evidence & Verification Report — Day 2 (2026-10-12)

**Project**: VERBAMIND  
**Milestones Covered**: Task 2.1 (Lifecycle Hardening), Task 2.2 (Upload & Storage), Task 2.3A (Audio Decoding & Transcription)  
**Execution Environment**: Windows 11, Node.js v23.3.0, Python 3.12.6, uv 0.12.23, AMD Ryzen 7 (16 logical cores)  

---

## 1. Automated Test Results Overview

| Test Suite | Test Files | Passed / Total | Duration | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Backend Pytest** | 10 suites | **56 / 56** | 2.25s | **PASS** |
| **Frontend Vitest** | 8 suites | **41 / 41** | 7.55s | **PASS** |
| **Combined Project Tests** | **18 suites** | **97 / 97** | — | **100% PASS** |
| **Frontend Production Build** | Vite + tsc | Clean build | 454ms | **PASS** |

---

## 2. Task 2.3A Audio Decoding & Transcription Test Details

### 2.1 Audio Decoder Unit Tests (`backend/tests/test_audio_decoder.py`)
- `test_decode_valid_wav_bytes`: **PASS** — Verifies stereo 44.1 kHz PCM downmixing to 16 kHz mono float32 with correct duration calculation and amplitude normalization in `[-1.0, 1.0]`.
- `test_decode_empty_bytes_rejected`: **PASS** — Raises `AudioDecodingError` on empty payload.
- `test_decode_corrupt_bytes_rejected`: **PASS** — Catches `av.FFmpegError` and converts to `AudioDecodingError`.
- `test_decode_nonexistent_file_rejected`: **PASS** — Raises `AudioDecodingError` on missing file.
- `test_decode_duration_limit_exceeded_rejected`: **PASS** — Raises `AudioDurationExceededError` when audio frames exceed the maximum duration cap.

### 2.2 Transcription Service Unit Tests (`backend/tests/test_transcription_service.py`)
- `test_missing_model_directory_raises_error`: **PASS** — Verifies `ModelNotFoundError` when local weights directory does not exist.
- `test_missing_model_bin_raises_error`: **PASS** — Verifies `ModelNotFoundError` when `model.bin` is missing from the model cache.
- `test_empty_audio_returns_empty_transcript`: **PASS** — Verifies zero-length arrays return empty text and segments without running inference.
- `test_transcription_mocked_success`: **PASS** — Verifies segments, words, start/end timestamps, and token `probability` (explicitly testing that probabilities are NOT labeled as pronunciation/fluency scores).
- `test_initial_prompt_invariant_preserved`: **PASS** — Asserts `initial_prompt=None` is passed to the underlying engine.
- `test_inference_failure_raises_transcription_error`: **PASS** — Wraps compute exceptions as `TranscriptionError`.
- `test_save_transcript_atomic`: **PASS** — Verifies atomic temporary file creation and replacement.

---

## 3. Real Model Inference Verification (Live User Recording)

- **Target File**: `backend/storage/recordings/sess_mv5a58rc_f1c9n/take_1.webm`
- **Execution Command**:
  ```powershell
  .venv\Scripts\python.exe -m backend.cli.transcribe --session-id sess_mv5a58rc_f1c9n --take 1
  ```
- **Measured Metrics**:
  - Original Audio Size: 743.8 KB (761,635 bytes)
  - Decoded Duration: **47.16 seconds**
  - PyAV Decoding Latency: **0.100 seconds** (WebM/Opus -> 16 kHz mono float32)
  - Offline Model: `base.en` (CTranslate2 int8 on CPU, 4 threads)
  - Model Load Time: 0.69 seconds
  - Inference Execution Time: **4.688 seconds**
  - Real-Time Factor (RTF): **0.10x** (10.1x faster than real-time playback)
  - Segments Extracted: 8
  - Word Timestamps Extracted: 96 words
  - Language Confidence: 1.000 (English)
- **Persisted Output**: `backend/storage/recordings/sess_mv5a58rc_f1c9n/transcript_take_1.json` (15.7 KB).
- **Git Hygiene**: Verified `transcript_take_1.json` is Git-ignored by line 31 of `.gitignore`.

---

## 4. Task 2.3B Connected API & UI Transcription Verification

### 4.1 Backend Transcription API Tests (`backend/tests/test_transcription_api.py`)
- `test_transcribe_missing_recording_returns_404`: **PASS** — Enforces `RECORDING_NOT_FOUND`.
- `test_transcribe_path_traversal_session_id_returns_400`: **PASS** — Enforces sanitized session regex guard.
- `test_transcribe_invalid_take_number_returns_422`: **PASS** — Rejects `take_number < 1`.
- `test_transcribe_development_mode_enforced`: **PASS** — Returns `403 Forbidden` (`DEVELOPMENT_ONLY_ENDPOINT`) in non-development environments.
- `test_transcribe_loopback_restriction`: **PASS** — Returns `403 Forbidden` (`FORBIDDEN_ORIGIN`) on external callers.
- `test_get_transcript_not_found_returns_404`: **PASS** — Enforces `TRANSCRIPT_NOT_FOUND`.
- `test_transcribe_and_get_lifecycle`: **PASS** — Full simulated lifecycle: submission, duplicate suppression, poll completion, and zero path exposure.
- `test_transcription_queue_full_returns_503`: **PASS** — Rejects job with `503 Service Unavailable` (`TRANSCRIPTION_QUEUE_FULL`) when bounded queue limit (5) is reached.

### 4.2 Frontend Hook & Component Tests
- `frontend/src/hooks/useTranscription.test.ts` (6 tests): **PASS**
  - Initial idle state
  - Parameter validation before dispatch
  - Immediate completion handling (cached disk hits)
  - Polling lifecycle (`queued` -> `processing` -> `completed`)
  - Error reporting on worker failure
  - `resetTranscription` timer cleanup and stale response discarding
- `frontend/src/components/AudioPlayer.test.tsx` (6 tests): **PASS**
  - Transcribe button renders after upload success
  - Safe text rendering (no HTML injection)
  - Academic integrity disclaimer verified
  - Timed segment viewer expand/collapse
  - Safe error handling and retry mechanism without recording loss

### 4.3 Real End-to-End Live API Transcription Verification
Executed via `scratch/test_live_transcription_api.py` against live FastAPI daemon (`http://127.0.0.1:8000/api`):
1. **Take #1 Disk Recovery**:
   - `GET /api/sessions/sess_mv5a58rc_f1c9n/recordings/1/transcript` -> `200 OK`
   - Retrieved 47.16s audio transcript (96 words) in 0.015s.
   - Zero server paths leaked.
2. **Take #2 Live Worker Queue & Inference**:
   - Uploaded Take #2 (743.8 KB WebM) -> `201 Created`
   - `POST /api/sessions/sess_mv5a58rc_f1c9n/recordings/2/transcribe` -> `202 Accepted` (`job_sess_mv5a58rc_f1c9n_take_2`, status: `queued`)
   - Duplicate POST within 50ms -> `202 Accepted` with identical `job_id`, status transitioned to `processing` (duplicate avoided)
   - Polling: Poll #1 (+1.5s, `processing`), Poll #2 (+3.0s, `processing`), Poll #3 (+4.5s, `processing`), Poll #4 (+6.0s, `completed`)
   - Total Wall Time: **6.02 seconds** (Inference time: **4.87 seconds**)
   - Recognized Text: 96 words across 8 timestamped segments
   - Audio duration: 47.16s, Real-Time Factor (RTF): ~0.10x

### 4.4 User Manual Evidence & Recognition Quality Observations
- **Evidence Source**: User-supplied screenshot showing the completed transcription UI card rendered on the live website for `Take #1`.
- **Verified Behavior**: Confirms the full end-to-end user journey in the browser: exercise selection $\rightarrow$ MediaRecorder capture $\rightarrow$ local upload $\rightarrow$ background worker execution $\rightarrow$ completed transcript card rendered with timestamped segments and Academic Integrity Notice.
- **Scientific Boundary (Accuracy NOT Claimed as Verified)**:
  - This user evidence verifies **system integration and pipeline completion**, NOT transcription accuracy.
  - Inspection of the recognized text reveals phonetic and proper-noun substitutions:
    - `"Yasir"` was misrecognised as `"Yasa"`
    - `"VerbaMind"` was misrecognised as `"global mind"`
    - `"final year"` was misrecognised as `"finally a"`
  - Assessment metrics (fluency score, reading accuracy, GoP pronunciation) must **not** be calculated until speech recognition quality is evaluated on calibrated recordings. Model recognition errors must never be conflated with user pronunciation errors.

---

## 5. Preliminary Model Comparison (`base.en` vs `small.en`)

- **Scope & Preliminary Status**: This evaluation is a preliminary development comparison on the user recording `take_1.webm` (47.16s). Because the manually verified reference transcript of what was actually spoken has not yet been submitted by the user, **formal Word Error Rate (WER) scoring is left pending**. The catalog passage must NOT be used as reference because the user spoke an interview self-introduction.
- **Decoding Configuration**:
  - Device: CPU (AMD Ryzen 7)
  - Precision: `int8` quantization (CTranslate2)
  - Execution Threads: 4 threads
  - Decoding Strategy: Greedy beam search (`beam_size=5`), `initial_prompt=None` (zero passage biasing).
- **Comparative Measurements**:
  - `base.en`:
    - Parameters: ~74 Million (138.5 MB)
    - Inference Time: **4.58 seconds**
    - Real-Time Factor (RTF): **0.097x** (10.3x faster than real time)
    - Word Count: 96 words across 8 segments
    - Raw Output: *"Hello and thank you for this opportunity, my name is Yasa and I am finally a computer science and engineering undergraduate specialization in artificial intelligence and machine learning. Over the past years, I have built a strong foundation in data structure algorithms and full-stack system design. My recent work focuses on developing global mind and automated speech analysis platform that assist engineering graduates in refining their communication, delivery, and enjoy breaking down complex software requirements into modular reliable components. I am eager to contribute to my power problem-solving skills and technological curiosity to engineering"*
  - `small.en`:
    - Parameters: ~244 Million (483.5 MB)
    - Inference Time: **9.82 seconds**
    - Real-Time Factor (RTF): **0.208x** (4.8x faster than real time)
    - Word Count: 96 words across 8 segments
    - Raw Output: *"Hello and thank you for this opportunity. My name is Yasir and I am final year computer science and engineering undergraduate specialization in artificial intelligence and machine learning. Over the past years I have built a strong foundation in data structure algorithms and full stack system design. My recent work focuses on developing verbal mind and automated speech analysis platform that assist engineering graduates in refining their communication delivery. I enjoy breaking down complex software requirements into modular reliable components. I am eager to contribute my power problem solving skills at technical curiosity to engineering team."*
- **Acoustic & Pronunciation Invariant**:
  - The recognition substitutions observed in `base.en` (`"Yasa"` vs `"Yasir"`, `"global mind"` vs `"verbal mind"`) reflect acoustic model capacity limits, not speaker pronunciation flaws. Model probabilities and recognition substitutions are never conflated with pronunciation or fluency scores.



