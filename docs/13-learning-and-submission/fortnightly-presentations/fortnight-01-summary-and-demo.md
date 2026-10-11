# Fortnight 1 Milestone Summary & Demo Package (Weeks 1–2)

**Milestone Focus**: Browser Audio Capture Engine, Practice Passage Catalog & Local Playback  
**Academic Period**: Fortnight 1 (Weeks 1 & 2)  
**Presenter / Student**: Yasir  
**Project**: VERBAMIND — AI-Assisted Placement Communication Coaching Platform  

---

## 1. Executive Summary
During this initial fortnightly sprint, the foundational audio engineering and practice interface for VERBAMIND was established. Rather than using mock APIs or relying on text-only simulated interactions, the project delivers a production-grade client-side voice recording studio using native browser hardware APIs (`MediaRecorder` and Web Audio `AudioContext`). 

Four structured read-aloud practice passages targeting technical explanations and HR behavioral interviews were authored. The system provides real-time audio input metering via a 16-bar animated waveform visualizer, complete permission lifecycle diagnostics (including address-bar remediation instructions), a 180-second safety cap, and an immediate audio preview player supporting scrub playback, local `.webm` download, and sequential retakes.

All 16 unit and integration tests pass under Vitest, and production build generation completes in under 300ms.

---

## 2. 5-Minute Live Demonstration Script (For Guide / Panel)

```
[00:00 - 00:45] Problem Context & Invariant Introduction
- Show the web app at http://127.0.0.1:5173/ in dark mode.
- Explain: "VERBAMIND helps students prepare for placement interviews by providing objective acoustic and linguistic feedback. A critical academic invariant of our system is that we strictly decouple Acoustic Fluency (speech rate, pauses) from Reading Accuracy (Word Error Rate) and Pronunciation Clarity."

[00:45 - 01:45] Exercise Selection & Guidance
- Demonstrate Section 1: "Choose a Read-Aloud Practice Passage".
- Switch filter tabs between "All Passages", "HR & Behavioral", and "Technical Explanations".
- Select "Explaining Distributed Caching & Invalidation".
- Highlight the real-time calculation: 138 words, target pacing ~135 WPM (estimated duration ~61 seconds).
- Point out the "Key Focus Words" chips (e.g. "Throughput", "Synchronously", "Invalidation") designed for phonetic articulation training.

[01:45 - 03:00] Live Recording & Web Audio Visualizer
- Scroll down to Section 2: "Browser Voice Recording Studio".
- Click "Start Recording". Show how browser microphone permission is acquired cleanly.
- Speak into the microphone. Point to the 16 dynamic waveform bars reacting to live sound pressure levels via the Web Audio AnalyserNode.
- Demonstrate controls: Click "Pause" (timer freezes, waveform settles), click "Resume" (timer and visualizer resume smoothly).
- Point out the live countdown progress bar and the 180-second memory protection cap.
- Click "Stop & Review".

[03:00 - 04:15] Audio Verification, Playback & Download
- Show the mounting of the "Take #1 Captured" audio player.
- Play back the recorded speech to demonstrate clear audio playback without distortion.
- Drag the seek scrubber to demonstrate precise timestamp jumping.
- Click "Download Audio" to demonstrate that the browser generates a real, valid `.webm` (Opus encoded) audio file saved locally to the machine.
- Click "Record Take #2" to demonstrate the retry loop: the recorder state machine resets cleanly, any previous hardware microphone lock is released, and take counter increments to Take #2.

[04:15 - 05:00] Testing & Architecture Summary
- Highlight the test suite: 16 automated tests covering permission denial (`NotAllowedError`), missing hardware (`NotFoundError`), recorder state transitions, and component rendering.
- Explain transition to Fortnight 2: Backend FastAPI upload endpoint and Whisper Speech-to-Text pipeline.
```

---

## 3. Slide Presentation Outline (10 Slides)

- **Slide 1**: Title, Candidate Name, Roll Number, Guide Name, Project Title: VERBAMIND.
- **Slide 2**: The Problem: The placement communication gap in engineering graduates (hesitation, uneven pace, fillers vs technical competence).
- **Slide 3**: The Scientific Invariant: Decoupling Fluency (acoustic) vs Reading Accuracy (linguistic) vs Pronunciation (phonetic) vs Answer Relevance (semantic).
- **Slide 4**: System Architecture: React + TypeScript frontend, Python FastAPI backend, PostgreSQL, private audio store.
- **Slide 5**: Milestone 1 Focus: Client-side Audio Capture Engine & Practice Catalog.
- **Slide 6**: Audio Architecture: `MediaRecorder` API (Opus codec chunking) + Web Audio `AnalyserNode` (real-time RMS visualizer).
- **Slide 7**: Edge Cases Handled: Permission denial with address-bar remediation, missing microphone detection, 180s buffer exhaustion protection, and hardware stream release.
- **Slide 8**: Verification & Evidence: 16 Vitest automated tests passing; production build verified (`tsc -b && vite build` in 288ms).
- **Slide 9**: Ethical & Security Safeguards: Zero cloud audio leakage, privacy-first client-side recording, no credentials committed.
- **Slide 10**: Fortnight 2 Roadmap: FastAPI backend scaffolding, Whisper speech-to-text with word-level timestamps.

---

## 4. Academic Viva Defense Q&A

### Q1: Why did you use `MediaRecorder` instead of WebRTC or Flash/plugins?
> **Answer**: `MediaRecorder` is the standardized, modern browser API for recording media streams directly without third-party plugins. It runs in browser sandbox memory, compresses raw PCM audio into standard container formats (`audio/webm` with Opus codec or `audio/mp4` with AAC) with minimal CPU overhead, and emits byte chunks asynchronously via the `ondataavailable` event. WebRTC is designed for peer-to-peer live teleconferencing across networks, which would introduce unnecessary socket signaling overhead for single-user speech recording.

### Q2: How does the visualizer compute volume levels without lag?
> **Answer**: We route the microphone stream into a Web Audio `AudioContext` and connect it to an `AnalyserNode`. Using Fast Fourier Transform (FFT) analysis with an `fftSize` of 256, we extract frequency bin data into a `Uint8Array`. By computing the root mean square (RMS) or average energy across the frequency bins and normalizing it onto a 0–100 scale on every `requestAnimationFrame`, we achieve a 60 FPS reactive waveform with virtually zero main-thread CPU latency.

### Q3: How do you guarantee the microphone doesn't stay open in the background after stopping?
> **Answer**: In our `useAudioRecorder` hook, the `releaseStream()` function iterates over every audio track in the active `MediaStream` (`streamRef.current.getTracks()`) and explicitly calls `track.stop()`. Furthermore, it closes the `AudioContext` and sets the `MediaRecorder` instance to `null`. This releases the hardware microphone lock at the operating system level, ensuring the browser's recording indicator disappears immediately.

### Q4: Why must acoustic fluency be separated from linguistic reading accuracy?
> **Answer**: Conflating them is a fundamental flaw in naive speech evaluation tools. A candidate might read a passage with 100% Word Error Rate accuracy (pronouncing every word exactly as written) but speak at a painful 60 WPM with 4-second awkward silences. Conversely, another speaker might speak with fluid, natural cadence (140 WPM, natural breathing pauses) but stumble over a single technical term. Conflating acoustic rhythm with textual fidelity prevents actionable diagnostic coaching.
