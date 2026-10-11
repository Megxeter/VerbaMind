# Requirements Traceability Matrix (RTM)

This matrix establishes end-to-end traceability between product requirements, architectural components, implementation files, test coverage, and current verification status.

| Req ID | Description | Architecture Component | Source File(s) | Test File(s) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-01.1** | Read-aloud exercise catalog | Frontend / Exercise module | `frontend/src/data/exercises.ts`, `ExerciseSelector.tsx` | `ExerciseSelector.test.tsx` | Implemented & User-Verified |
| **FR-01.2** | Word count & reading target guidelines | Frontend / Exercise module | `frontend/src/data/exercises.ts` | `ExerciseSelector.test.tsx` | Implemented & User-Verified |
| **FR-02.1** | Browser MediaRecorder audio capture | Frontend / Audio Engine | `frontend/src/hooks/useAudioRecorder.ts` | `useAudioRecorder.test.ts` | Implemented & User-Verified |
| **FR-02.2** | Microphone permission handling (granted/denied/error) | Frontend / Audio Engine | `frontend/src/hooks/useAudioRecorder.ts`, `MicPermissionNotice.tsx` | `useAudioRecorder.test.ts` | Implemented & User-Verified |
| **FR-02.3** | Recording controls (Start, Pause, Resume, Stop, Retry) | Frontend / UI Components | `frontend/src/components/RecorderControls.tsx` | `RecorderControls.test.tsx` | Implemented & User-Verified |
| **FR-02.4** | Real-time elapsed timer & audio level indicator | Frontend / UI Components | `frontend/src/components/AudioVisualizer.tsx` | `AudioVisualizer.test.tsx` | Implemented & User-Verified |
| **FR-02.5** | Instant client-side audio playback with seek | Frontend / Audio Player | `frontend/src/components/AudioPlayer.tsx` | `AudioPlayer.test.tsx` | Implemented & User-Verified |
| **INFRA-01**| FastAPI service liveness & CORS gateway | Backend / API Core | `backend/main.py`, `health.py`, `config.py`, `errors.py`, `useBackendStatus.ts` | `test_health.py`, `test_cors.py`, `test_errors.py`, `Header.test.tsx` | Implemented & Verified |
| **INFRA-02**| Private audio storage abstraction | Backend / Storage Service | `backend/services/storage.py` | `test_storage.py` | Implemented & Verified |
| **FR-03.1** | Speech transcription with word timestamps | Backend / STT Worker | `backend/services/stt.py` | `test_stt.py` | Proposed (Phase 2) |
| **FR-03.2** | Acoustic pause & filler detection | Backend / Acoustic Worker | `backend/services/acoustics.py` | `test_acoustics.py` | Proposed (Phase 2) |
| **FR-04.1** | Interactive timestamp-linked transcript | Frontend / Feedback UI | `frontend/src/components/InteractiveTranscript.tsx` | `InteractiveTranscript.test.tsx` | Proposed (Phase 3) |
| **FR-04.3** | Take-by-take retry comparison | Frontend / Analytics | `frontend/src/components/RetryComparison.tsx` | `RetryComparison.test.tsx` | Proposed (Phase 3) |

---

## Status Legend
- **Proposed**: Formally specified in PRD, awaiting milestone implementation.
- **Implemented & Verified**: Code written and automated unit/integration tests passing.
- **Implemented & User-Verified**: Automated tests passing and user-reported live browser verification completed.
