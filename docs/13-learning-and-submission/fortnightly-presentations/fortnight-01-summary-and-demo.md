# Fortnight 1 Milestone Summary & Demo Package (Weeks 1–2)

**Milestone Focus**: Browser Audio Capture Engine, Practice Passage Catalog & Local Playback  
**Academic Period**: Fortnight 1 (Weeks 1 & 2)  
**Presenter / Student**: Yasir  
**Project**: VERBAMIND — AI-Assisted Placement Communication Coaching Platform  

---

## 1. Executive Summary
During this initial fortnightly sprint, both the foundational client-side audio engineering studio, the Python FastAPI backend service, and the offline speech recognition engine were established for VERBAMIND. 

Rather than using mock APIs or simulated interactions, the project delivers:
1. **Client-side voice recording studio with verified lifecycle safety**: Built using native browser hardware APIs (`MediaRecorder` and Web Audio `AudioContext`). Four structured read-aloud practice passages targeting technical explanations and HR behavioral interviews are included. Features 16-bar animated waveform visualizer (frequency-bin averaging), complete permission lifecycle diagnostics (including address-bar remediation instructions), a 180-second safety cap, and an immediate audio preview player supporting scrub playback, local `.webm` download, and sequential retakes. Verified lifecycle hardening ensures single idempotent finalisation on both manual and auto-stops, AudioContext reuse across pause/resume, stream release on startup error, and suppression of stale callbacks on reset or unmount.
2. **FastAPI backend service & private storage engine**: Modular Python 3.12 application managed via `uv`, with centralized typed settings (`Pydantic BaseSettings`), strict CORS whitelist (restricting browser JS access to exact local origins), global sanitized exception handlers, health liveness probe (`GET /api/health`), and a private atomic audio storage engine (`LocalStorageService`) with path traversal defenses (`path.is_relative_to` and regex validation `^[a-zA-Z0-9_\-]+$`), binary magic byte sniffer, and overwrite protection.
3. **Offline speech transcription pipeline**: Local audio decoding via PyAV (`av==19.0.1`) downmixing to 16 kHz mono float32 with duration bounding. Offline Faster-Whisper recognition using `base.en` (CTranslate2 int8 on CPU, 4 threads) generating word-level timestamps without remote API calls or prompt passage biasing. Non-blocking bounded worker queue (`maxsize=5`) running off the async event loop.
4. **Live website integration & fault-tolerance**: Frontend automatically monitors backend liveness (`API Online (v0.1.0)` / `API Offline`), supports one-click audio upload with local persistence confirmation, and triggers local speech transcription with real-time status banners, safe plain-text rendering, collapsible timed segments, and explicit academic integrity disclaimers.

All 92 automated tests (51 Pytest, 41 Vitest) pass cleanly with 0 warnings, and production build generation completes in under 600ms.

---

## 2. 5-Minute Live Demonstration Script (For Guide / Panel)

```
[00:00 - 00:45] Problem Context & Invariant Introduction
- Show the web app at http://127.0.0.1:5173/ in dark mode.
- Point to the Header badge: "API Online (v0.1.0)" showing live connectivity to the FastAPI server at http://127.0.0.1:8000/api/health.
- Explain: "VERBAMIND helps students prepare for placement interviews by providing objective acoustic and linguistic feedback. A critical academic invariant of our system is that we strictly decouple Acoustic Fluency (speech rate, pauses) from Reading Accuracy (Word Error Rate) and Pronunciation Clarity (phoneme intelligibility)."

[00:45 - 01:45] Exercise Selection & Guidance
- Demonstrate Section 1: "Choose a Read-Aloud Practice Passage".
- Switch filter tabs between "All Passages", "HR & Behavioral", and "Technical Explanations".
- Select "Explaining Distributed Caching & Invalidation".
- Highlight the real-time calculation: 138 words, target pacing ~135 WPM (estimated duration ~61 seconds).
- Point out the "Key Focus Words" chips (e.g. "Throughput", "Synchronously", "Invalidation") designed for phonetic articulation training.

[01:45 - 03:00] Live Recording & Web Audio Visualizer
- Scroll down to Section 2: "Browser Voice Recording Studio".
- Click "Start Recording". Show how browser microphone permission is acquired cleanly.
- Speak into the microphone. Point to the 16 dynamic waveform bars reacting to live sound pressure levels via the Web Audio AnalyserNode (frequency-bin averaging).
- Demonstrate controls: Click "Pause" (timer freezes, AudioContext suspends, waveform settles), click "Resume" (timer and visualizer resume smoothly without re-instantiating AudioContext).
- Point out the live countdown progress bar and the 180-second memory protection cap.
- Click "Stop & Review".

[03:00 - 04:00] Audio Verification, Upload & Offline Speech Recognition
- Show the mounting of the "Take #1 Captured" audio player.
- Play back the recorded speech to demonstrate clear audio playback without distortion.
- Click "Upload Recording" -> Instant feedback: "Take #1 Persisted Locally (take_1.webm)" with zero cloud transfer.
- Click "Transcribe Speech" -> The offline Whisper base.en model processes the audio on a bounded background CPU worker thread (real RTF ~0.10x).
- Observe the Recognised Speech Transcript card appear:
  - Exact recognized text displayed safely as plain text (no HTML).
  - Model metadata: whisper base.en (int8 on CPU), audio duration, latency, and word count.
  - Expand "View Timestamped Segments" showing precise start/end time markers.
  - Highlight the Academic Integrity Notice: explains that model token probabilities are internal acoustic weights and are NOT pronunciation or fluency scores.

[04:00 - 05:00] Architecture, Security & Scientific Rigor
- Point out the non-blocking worker queue: FastAPI async event loop never freezes during compute-intensive inference.
- Show duplicate protection: multiple clicks on transcribe return the existing active job without redundant tasks.
- Demonstrate private storage: Audio recordings and transcripts are private, excluded from Git, and cannot be accessed via static routes.
- Summarize verification evidence: 51 backend tests (pytest) + 41 frontend tests (vitest) = 92 automated tests passing, plus real live inference benchmarks verified.
```

---

## 3. Slide Presentation Outline (10 Slides)

- **Slide 1**: Title, Candidate Name, Roll Number, Guide Name, Project Title: VERBAMIND.
- **Slide 2**: The Problem: The placement communication gap in engineering graduates (hesitation, uneven pace, fillers vs technical competence).
- **Slide 3**: The Scientific Invariant: Decoupling Fluency (acoustic) vs Reading Accuracy (linguistic) vs Pronunciation (phonetic) vs Answer Relevance (semantic).
- **Slide 4**: Full System Architecture: React + TypeScript frontend, Python FastAPI backend, strict CORS gateway, private audio filesystem store.
- **Slide 5**: Milestone 1 Focus: Client-side Audio Capture Engine & Practice Catalog.
- **Slide 6**: Audio Architecture: `MediaRecorder` API (Opus codec chunking) + Web Audio `AnalyserNode` (real-time frequency-bin averaging visualizer).
- **Slide 7**: Edge Cases Handled: Permission denial with address-bar remediation, missing microphone detection, 180s buffer exhaustion protection, AudioContext reuse, and hardware stream release.
- **Slide 8**: Backend Foundation (Task 2.1): FastAPI modular architecture, strict CORS whitelist (no wildcards), sanitized error envelopes, and private `LocalStorageService` with traversal defense.
- **Slide 9**: Verification & Evidence: 24 Vitest automated tests + 10 Pytest automated tests (34 total, 0 warnings); fault-injection recovery verified; production build verified in 310ms.
- **Slide 10**: Fortnight 2 Roadmap: Audio upload endpoint (`POST /api/sessions/{session_id}/recording`), Whisper speech-to-text pipeline with word-level start/end timestamps.

---

## 4. Academic Viva Defense Q&A

### Q1: Why did you use `MediaRecorder` instead of WebRTC or Flash/plugins?
> **Answer**: `MediaRecorder` is the standardized, modern browser API for recording media streams directly without third-party plugins. It runs in browser sandbox memory, compresses raw PCM audio into standard container formats (`audio/webm` with Opus codec or `audio/mp4` with AAC) with minimal CPU overhead, and emits byte chunks asynchronously via the `ondataavailable` event. WebRTC is designed for peer-to-peer live teleconferencing across networks, which would introduce unnecessary socket signaling overhead for single-user speech recording.

### Q2: How does the visualizer compute volume levels without lag?
> **Answer**: We route the microphone stream into a Web Audio `AudioContext` and connect it to an `AnalyserNode`. Using Fast Fourier Transform (FFT) analysis with an `fftSize` of 256, we extract frequency bin data into a `Uint8Array`. By calculating the arithmetic mean magnitude across the frequency bins (frequency-bin averaging) and normalizing it onto a 0–100 scale on every `requestAnimationFrame`, we achieve a 60 FPS reactive waveform with virtually zero main-thread CPU latency. Note that this is spectral frequency-bin averaging, not time-domain root mean square (RMS) amplitude calculation.

### Q3: How do you guarantee the microphone doesn't stay open in the background after stopping?
> **Answer**: In our `useAudioRecorder` hook, the `releaseStream()` function iterates over every audio track in the active `MediaStream` (`streamRef.current.getTracks()`) and explicitly calls `track.stop()`. Furthermore, it closes the `AudioContext` and sets the `MediaRecorder` instance to `null`. This releases the hardware microphone lock at the operating system level, ensuring the browser's recording indicator disappears immediately.

### Q4: Why must acoustic fluency be separated from linguistic reading accuracy?
> **Answer**: Conflating them is a fundamental flaw in naive speech evaluation tools. A candidate might read a passage with 100% Word Error Rate accuracy (pronouncing every word exactly as written) but speak at a painful 60 WPM with 4-second awkward silences. Conversely, another speaker might speak with fluid, natural cadence (140 WPM, natural breathing pauses) but stumble over a single technical term. Conflating acoustic rhythm with textual fidelity prevents actionable diagnostic coaching.
> Crucially, **reading accuracy does NOT establish pronunciation**: a speaker can read every word from a script with 100% lexical fidelity while mispronouncing vowels, consonant clusters, or syllable stresses. Pronunciation measures phonetic clarity via acoustic model posteriors (Goodness of Pronunciation GoP), which must remain separate from textual word accuracy.

### Q5: Why is the backend audio storage directory not exposed via a static file route?
> **Answer**: Exposing user voice recordings over static routes (e.g. `/static/recordings/{filename}`) introduces severe privacy risks, predictable URL enumeration, and bypasses session authorization. In VERBAMIND, recordings are saved in a private filesystem location through `LocalStorageService` and are never mounted to Starlette's `StaticFiles`. In subsequent tasks, any audio retrieval will require session authorization headers and stream bytes through controlled application endpoints.

### Q6: How does the backend prevent Directory Traversal attacks when saving user recordings?
> **Answer**: When handling user session identifiers, our `LocalStorageService` executes two layers of defense: first, a strict regular expression check (`^[a-zA-Z0-9_\-]+$`) rejects any path navigation characters such as `..`, `/`, or `\`. Second, before opening or writing to the target file, it resolves the canonical path and asserts `path.is_relative_to(base_storage_dir)`. If the resolved path points outside the designated root, a `ValueError` is immediately raised.

### Q7: Why use self-hosted `faster-whisper` on CPU (int8) instead of an external speech-to-text API (e.g. OpenAI or Google Cloud)?
> **Answer**: Privacy and academic reproducibility are paramount. Sending student speech to external hosted APIs violates local privacy guarantees, introduces external API costs and latency dependencies, and risks data leakage. `faster-whisper` uses CTranslate2 (a custom C++ inference engine) to execute the quantized `base.en` Whisper model on standard developer CPU cores with int8 precision. Our benchmarks show a Real-Time Factor (RTF) of ~0.10x (a 47-second recording decodes and transcribes in ~4.8 seconds), entirely offline with zero external network traffic.

### Q8: Why are model token probabilities NOT used as pronunciation or fluency scores?
> **Answer**: Whisper is an end-to-end encoder-decoder sequence-to-sequence model designed for speech recognition. Its token probabilities represent the decoder's acoustic-language prior confidence that a specific subword token was uttered. Conflating token probability with human pronunciation clarity or fluency is scientifically invalid: a speaker can pronounce a word with terrible phonetic distortion that the language model reconstructs with high probability due to surrounding context, or conversely pronounce a rare proper noun with native clarity that the model assigns low probability. Pronunciation requires acoustic phonetic alignment (e.g., phoneme-level Goodness of Pronunciation GoP), which is decoupled from ASR token probabilities.


