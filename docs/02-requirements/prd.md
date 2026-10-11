# Product Requirements Document (PRD) — VERBAMIND

## 1. Objective
Enable engineering candidates to independently diagnose, measure, and improve their English communication delivery for campus placements through objective, evidence-based acoustic and linguistic feedback.

---

## 2. Assessment Separation (Core Invariant)
To maintain academic rigor and diagnostic utility, four evaluation dimensions are strictly decoupled:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VERBAMIND ASSESSMENT ENGINE                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────┬───────────┴───────────┬───────────────────┐
    ▼                   ▼                       ▼                   ▼
┌───────────────┐ ┌───────────────────┐ ┌───────────────┐ ┌─────────────────┐
│ 1. FLUENCY    │ │2. READING ACCURACY│ │3.PRONUNCIATION│ │ 4. RELEVANCE    │
│ (Acoustic)    │ │   (Linguistic)    │ │   (Phonetic)  │ │   (Semantic)    │
├───────────────┤ ├───────────────────┤ ├───────────────┤ ├─────────────────┤
│ • Speech Rate │ │ • Word Error Rate │ │ • Phoneme     │ │ • Semantic sim- │
│ • Pause Ratio │ │ • Insertions      │ │   confidence  │ │   ilarity to    │
│ • Fillers/min │ │ • Deletions       │ │ • Articulation│ │   interview     │
│ • Hesitations │ │ • Substitutions   │ │   clarity     │ │   question      │
└───────────────┘ └───────────────────┘ └───────────────┘ └─────────────────┘
```

1. **Fluency**: Evaluates temporal rhythm, speaking pace (words per minute), silent pause duration, filled pauses, and flow continuity. An accented or imperfect speaker can still be fluent if delivery is coherent and smooth.
2. **Reading Accuracy**: Evaluates verbatim text alignment during read-aloud drills (WER, skipped words, inserted words, word order flips). Applicable only to read-aloud tasks.
3. **Pronunciation**: Evaluates phonetic clarity, intelligible vowel/consonant enunciation, and phoneme posterior probabilities. Evaluated separately from cadence or vocabulary.
4. **Answer Relevance**: Evaluates whether the spoken response actually answered the prompt or interview question (embedding similarity / key point coverage). Applicable to topic speaking and mock interviews.

---

## 3. User Personas
- **Rohan (Final-Year CS Student)**: Has strong coding skills but speaks too fast (210 WPM) when nervous, filling gaps with "like", "actually", and "um". Needs pacing feedback and pause awareness.
- **Priya (Pre-Final Electronics Student)**: Hesitates frequently, experiencing 3-4 second silent blocks while translating thoughts. Needs low-stakes read-aloud exercises to build speaking momentum.
- **Academic Evaluator / Viva Examiner**: Wants to see clear architectural modularity, real evaluation metrics on unseen test speakers, and no unsubstantiated claims.

---

## 4. Functional Requirements (FR)

### FR-01: Exercise Catalog
- **FR-01.1**: The system must provide structured read-aloud passages categorized by difficulty (Beginner, Intermediate, Advanced) and context (Technical overview, Placement HR scenarios, General workplace).
- **FR-01.2**: Each passage must display word count, estimated target reading duration, and guidance points.

### FR-02: Client-side Audio Capture
- **FR-02.1**: The user must be able to record their voice directly within the browser using the `MediaRecorder` API.
- **FR-02.2**: The interface must explicitly request microphone permissions and handle all states (`prompt`, `granted`, `denied`, `unavailable`).
- **FR-02.3**: Clear recording controls must be present: Start, Pause, Resume, Stop, and Discard/Retry.
- **FR-02.4**: During recording, provide real-time elapsed time tracking, maximum recording time cap (e.g. 3 minutes per take), and an active volume/waveform visualization.
- **FR-02.5**: Immediate client-side playback must be available before submission.

### FR-03: Transcription & Acoustic Feature Extraction (Phase 2)
- **FR-03.1**: Speech-to-text pipeline generates word-level timestamps `(word, start_ms, end_ms)`.
- **FR-03.2**: Acoustic processor detects pauses longer than 250ms and flags filler vocalizations (`um`, `uh`).
- **FR-03.3**: Compute words per minute (WPM), articulation rate, and pause-to-speech ratio.

### FR-04: Evidence-Linked UI & Retry Comparison (Phase 3)
- **FR-04.1**: Interactive transcript where clicking any word seeks the audio player to that exact millisecond.
- **FR-04.2**: Visual highlighting of detected pause locations and filler occurrences.
- **FR-04.3**: Side-by-side retry comparison showing previous take vs current take metrics.

---

## 5. Non-Functional Requirements (NFR)
- **NFR-01 (Security & Privacy)**: Audio files must be stored in private storage with authenticated access; no audio URL may be publicly enumerable.
- **NFR-02 (Performance)**: Client recording must start with < 150ms latency upon user click. Recording audio chunks must be kept in memory or blob without memory leaks.
- **NFR-03 (Reliability)**: The UI must gracefully handle microphone disconnection or user navigation during active recording.
- **NFR-04 (Simplicity & Maintainability)**: Codebase must remain modular, well-typed (TypeScript strict mode), and straightforward to run locally.
