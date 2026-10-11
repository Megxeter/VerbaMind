# Project Scope & Roadmap

## 1. In-Scope Features (6-Month Horizon)
The project scope is designed for a disciplined, daily 5-hour workflow across 6 months.

### Phase 1: Core Voice Capture & Playback (Month 1 - Weeks 1-2)
- Clean, responsive React + TypeScript web app.
- Exercise selector (Read-aloud passages and topic prompts).
- Robust client-side Web Audio & MediaRecorder recording engine with permission states, timer, waveform visualization, pause/resume, and instant playback.
- Safe audio blob handling and validation (duration caps, format checks).

### Phase 2: Speech Processing Pipeline & Audio Storage (Month 1 - Weeks 3-4 & Month 2)
- FastAPI backend with secure audio upload endpoint and private local/object storage.
- Speech-to-Text transcription pipeline with word-level timestamps.
- Explicit metric extraction:
  - Speaking pace (Words Per Minute / Syllables Per Second).
  - Pause analysis (filled pauses vs silent pauses > 250ms).
  - Filler word detection (um, uh, like, you know, actually, basically).
  - Repetition and false start detection.
- Interactive transcript player synchronized with audio playback.

### Phase 3: Evidence-Linked Feedback & Retry Comparison (Month 3)
- Clickable transcript tokens linked to audio seek points.
- Visual breakdown cards for Pace, Pauses, Fillers, and Vocabulary.
- Take-by-take side-by-side retry comparison (Take 1 vs Take 2 deltas).
- User session history and progress graphs.

### Phase 4: Machine Learning — Custom Fluency Model (Months 4-5)
- Dataset curation (open-source speech corpora such as Speechocean762 / LibriSpeech / Toastmasters recordings).
- Acoustic feature engineering (Prosodic, temporal, spectral, MFCCs, fundamental frequency $F_0$).
- Training custom fluency model (e.g. gradient-boosted trees / Bi-LSTM / Transformer acoustic head).
- Evaluation strictly on unseen speakers with verifiable metrics (MAE, Pearson correlation, Spearman rank).
- No invented or synthetic test benchmark claims.

### Phase 5: Placement Mock Interviews & Submission Prep (Month 6)
- Placement-oriented interview question library (Behavioral, HR, Technical explanation).
- Answer relevance scoring (semantic embedding alignment with question context, kept separate from acoustic fluency).
- Final academic thesis, viva defense presentation, and comprehensive test documentation.

---

## 2. Explicitly Out-of-Scope (Boundaries)
- **Mobile Apps / Flutter**: Strictly web application only.
- **Real-Time Synchronous Video Streaming**: Focus is purely on vocal communication and acoustic clarity; no webcam computer vision tracking or pose analysis.
- **Complex Cloud-Only Microservice Mesh**: Monolithic modular architecture preferred for maintainability and clear academic viva demonstration.
- **Automated Grading Without User Agency**: All metrics provide diagnostic guidance, not punitive black-box scores.
