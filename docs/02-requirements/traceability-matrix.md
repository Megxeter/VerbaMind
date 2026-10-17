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
| **FR-02.6** | Browser recording upload & atomic persistence | Backend & Frontend Storage | `frontend/src/hooks/useAudioUpload.ts`, `AudioPlayer.tsx`, `recordings.py`, `storage.py`, `audio_validator.py` | `test_recordings.py`, `test_storage.py`, `test_audio_validator.py`, `useAudioUpload.test.ts`, `AudioPlayer.test.tsx` | Implemented & User-Verified |
| **FR-03.1** | Speech transcription with word timestamps | Backend / STT Service | `backend/services/audio_decoder.py`, `transcription.py`, `cli/transcribe.py` | `test_audio_decoder.py`, `test_transcription_service.py` | Implemented & Verified |
| **FR-03.1B**| Bounded async worker queue & transcription API | Backend / Worker & API | `backend/services/transcription_worker.py`, `backend/api/v1/endpoints/transcription.py` | `test_transcription_api.py`, `scratch/test_live_transcription_api.py` | Implemented & Verified |
| **FR-03.1C**| Offline ASR model comparison & WER evaluation | Backend / ASR CLI & Models | `backend/cli/compare_models.py`, `models/whisper/small.en` | `test_model_comparison.py` | Implemented & Verified |
| **FR-04.1A**| Browser transcription trigger & safe text presentation | Frontend / Audio Player & Hooks | `frontend/src/hooks/useTranscription.ts`, `frontend/src/components/AudioPlayer.tsx` | `useTranscription.test.ts`, `AudioPlayer.test.tsx` | Implemented & Verified |
| **FR-03.2** | Acoustic speech activity & internal non-speech gap analysis | Backend / Acoustic Service | `backend/services/acoustics.py`, `backend/api/v1/endpoints/acoustics.py` | `test_acoustics.py`, `test_acoustics_api.py` | Implemented & User-Verified |
| **FR-04.1B**| Browser acoustic delivery measurements panel, gap breakdown & clickable gap seeking | Frontend / Audio Player & Hooks | `frontend/src/hooks/useAcoustics.ts`, `frontend/src/components/AudioPlayer.tsx` | `useAcoustics.test.ts`, `AudioPlayer.test.tsx` | Implemented & User-Verified |
| **FR-04.1** | Interactive timestamp-linked transcript with word seeking & active highlighting | Frontend / Audio Player | `frontend/src/components/AudioPlayer.tsx` | `AudioPlayer.test.tsx` | Implemented & User-Verified |
| **FR-04.3** | Same-exercise attempt comparison & baseline retention | Frontend / Comparison Engine | `frontend/src/utils/comparison.ts`, `frontend/src/hooks/useAttemptComparison.ts`, `frontend/src/components/AttemptComparison.tsx`, `frontend/src/components/AudioPlayer.tsx` | `comparison.test.ts`, `useAttemptComparison.test.ts`, `AttemptComparison.test.tsx`, `AudioPlayer.test.tsx` | Implemented & User-Verified |
| **FR-03.2B**| Filler word detection ('um', 'uh') | Backend / Acoustic Worker | `backend/services/fillers.py` | `test_fillers.py` | Proposed (Phase 2) |

---

## Status Legend
- **Proposed**: Formally specified in PRD, awaiting milestone implementation.
- **Implemented & Verified**: Code written and automated unit/integration tests passing.
- **Implemented & User-Verified**: Automated tests passing and user-reported live browser verification completed.
