# Implementation Milestones

## Roadmap Overview

```
Milestone 1 [IN PROGRESS] ──> Milestone 2 ──> Milestone 3 ──> Milestone 4 ──> Milestone 5
Audio Capture & Playback      FastAPI & STT   Evidence Feedback  Fluency Model    Mock Interviews & Viva
```

---

## Milestone 1: Voice Capture, Exercises & Playback (Completed)
**Goal**: Build a complete, resilient client-side browser recording loop with exercise selection, microphone permission management, real-time timer/visualizer, and playback.

- [x] Exercise catalog with diverse difficulty tiers and guidance parameters.
- [x] Client-side audio recording engine using Web Audio & `MediaRecorder` APIs.
- [x] Microphone permission state handling (`prompt`, `granted`, `denied`, `unavailable`).
- [x] Recording controls (Start, Pause, Resume, Stop, Discard/Retry).
- [x] Live elapsed timer, max recording duration limit (180s), and live audio level visualizer.
- [x] Audio playback player with play/pause, scrub bar, duration, and download capability.
- [x] Unit test suite covering recorder hook state transitions and component rendering.
- [x] End-to-end browser verification of the audio recording and playback loop.

---

## Milestone 2: Backend Scaffold, Upload API & STT Pipeline (Verified Core / Benchmark Calibration Active)
**Goal**: FastAPI backend, private audio storage, Whisper transcription with word timestamps, and model evaluation.
- [x] Scaffold FastAPI backend with `uv` and strict loopback/CORS boundaries.
- [x] Implement `POST /api/sessions/{session_id}/recordings/{take_number}` with validation (mime type, size cap, duration).
- [x] Local private audio storage manager (`storage/recordings/{session_id}/take_{n}.webm`).
- [x] Whisper offline STT service with PyAV decoding and word-level timestamps (`word`, `start`, `end`, `probability`).
- [x] Bounded asynchronous worker queue (`transcription_worker.py`) with memory deduplication.
- [x] Full-stack browser integration: upload and offline transcription rendered with Academic Integrity Notice.
- [x] Offline model comparison tooling (`base.en` vs `small.en`) with Levenshtein alignment.
- [ ] Multi-recording ASR benchmark calibration on 3 recordings with verified human ground truth (Pending user-verified reference transcripts).

---

## Milestone 3: Acoustic Metrics & Evidence-Linked Feedback (In Progress)
**Goal**: Decoded audio acoustic analysis, speech activity ratio, internal non-speech gaps, speaking pace calculation, clickable gap seeking, and interactive feedback.
- [x] Acoustic analysis module & delivery panel: decoded audio timing, speech activity ratio, leading/trailing silence separation, internal non-speech gaps (≥ 250ms), clickable gap seeking, transcript-derived WPM, and frontend Audio Delivery Measurements panel with stale-take guards. (Implemented & User-Verified)
- [x] Synchronized interactive transcript player linked to audio playback with word-seeking, real-time playback highlighting, segment fallback, and approximate alignment notice. (Implemented & User-Verified)
- [ ] Acoustic pause thresholding & filled pause detection (`um`, `uh`). (Deferred to future increment)
- [ ] Retry comparison view (Take 1 vs Take 2 deltas). (Planned Phase 3)

---

## Milestone 4: Custom Fluency Model & Acoustic Feature Extraction
**Goal**: Train, tune, and evaluate custom fluency scoring model on unseen speakers.
- [ ] Acoustic feature extractor (F0 pitch variation, spectral flux, MFCCs, pause duration ratios).
- [ ] Public dataset curation (Speechocean762 / LibriSpeech).
- [ ] Fluency regression model trained on acoustic features.
- [ ] Cross-speaker validation and ablation study.

---

## Milestone 5: Placement Mock Interviews & Project Defense
**Goal**: Placement question catalog, semantic answer relevance, comprehensive viva prep.
- [ ] HR and technical interview question bank.
- [ ] Semantic answer relevance scoring (decoupled from acoustic fluency).
- [ ] Viva defense walkthrough and comprehensive documentation.
