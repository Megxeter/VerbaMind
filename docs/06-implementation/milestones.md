# Implementation Milestones

## Roadmap Overview

```
Milestone 1 [IN PROGRESS] ──> Milestone 2 ──> Milestone 3 ──> Milestone 4 ──> Milestone 5
Audio Capture & Playback      FastAPI & STT   Evidence Feedback  Fluency Model    Mock Interviews & Viva
```

---

## Milestone 1: Voice Capture, Exercises & Playback (Current)
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

## Milestone 2: Backend Scaffold, Upload API & STT Pipeline
**Goal**: FastAPI backend, private audio storage, Whisper transcription with word timestamps.
- [ ] Scaffold FastAPI backend with `uv`.
- [ ] Implement `POST /api/exercises/` and `GET /api/exercises/`.
- [ ] Implement `POST /api/sessions/{id}/recording` with validation (mime type, size cap, duration).
- [ ] Whisper STT integration generating word timestamps `(word, start_ms, end_ms)`.
- [ ] Local private audio storage manager.

---

## Milestone 3: Acoustic Metrics & Evidence-Linked Feedback
**Goal**: Pause detection, filler word counting, speaking pace calculation, and interactive transcript.
- [ ] Speaking pace (WPM / Syllables per second).
- [ ] Silent pauses (> 250ms) and filled pauses (`um`, `uh`).
- [ ] Synchronized transcript player linked to audio playback.
- [ ] Retry comparison view (Take 1 vs Take 2 deltas).

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
