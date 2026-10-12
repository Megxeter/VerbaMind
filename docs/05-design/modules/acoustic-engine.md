# Low-Level Design (LLD): Acoustic Analysis Engine

## 1. Module Overview
- **Module Path**: `backend/src/backend/services/acoustics.py`
- **Dependencies**: `numpy`, `re`, `backend.services.audio_decoder`
- **Responsibilities**:
  1. Ingest 16 kHz float32 mono PCM arrays with original timing and silence preserved.
  2. Perform short-time energy Root Mean Square (RMS) frame analysis.
  3. Bridge unvoiced phonetic stops via hangover window.
  4. Separate leading and trailing silence from internal non-speech intervals.
  5. Measure physical durations and speech activity ratio.
  6. Calculate transcript-derived speaking rate (total WPM and active articulation rate) with zero-division safety.

---

## 2. Data Structures

```python
@dataclass(frozen=True)
class AcousticGap:
    start_seconds: float
    end_seconds: float
    duration_seconds: float


@dataclass(frozen=True)
class AcousticAnalysisResult:
    # Waveform Timings (Pure Acoustic Measurements)
    total_duration_seconds: float
    detected_speech_duration_seconds: float
    speech_activity_ratio: float
    leading_silence_seconds: float
    trailing_silence_seconds: float

    # Internal Non-Speech Gaps
    internal_gaps: list[AcousticGap]
    internal_gap_count: int
    total_internal_gap_duration_seconds: float
    mean_internal_gap_duration_seconds: float

    # Transcript-Derived Metrics
    transcript_word_count: int | None
    words_per_minute_total: float | None
    words_per_minute_speech_only: float | None
    rate_is_transcript_dependent: bool

    # Detector Configuration
    detector_type: str = "frame_energy_rms"
    energy_threshold_db: float = -40.0
    min_gap_duration_seconds: float = 0.25
    sample_rate_hz: int = 16000
```

---

## 3. Algorithm Details

```
Decoded PCM (16 kHz float32)
         │
         ▼
[Strided Frame Extraction] (25 ms frame, 10 ms hop)
         │
         ▼
[Frame RMS & dBFS Conversion] (dBFS = 20 * log10(RMS + 1e-7))
         │
         ▼
[Thresholding] (frame_speech = db >= -40.0 dBFS)
         │
         ▼
[Hangover Window Bridging] (Bridge non-speech intervals <= 150 ms)
         │
         ▼
[Burst Filtering] (Discard speech segments < 80 ms)
         │
         ├──────────────────────────────┬──────────────────────────────┐
         ▼                              ▼                              ▼
[Leading Silence]             [Internal Gaps (>= 250ms)]       [Trailing Silence]
(0.0 to first speech start)   (between speech segments)        (last speech end to total duration)
         │                              │                              │
         └──────────────────────────────┼──────────────────────────────┘
                                        ▼
                           [AcousticAnalysisResult]
```

### 3.1 RMS Calculation
For a frame of $N = 400$ samples:
$$\text{RMS} = \sqrt{\frac{1}{N} \sum_{i=0}^{N-1} x[i]^2}$$
$$\text{dBFS} = 20 \log_{10}(\text{RMS} + 10^{-7})$$

### 3.2 Hangover Window
Unvoiced plosives (e.g. English /p/, /t/, /k/) feature silent closure intervals of 30–80 ms preceding the release burst. Without hangover bridging, continuous lexical words fragment into pseudo-pauses. A 150 ms hangover window bridges these closures while preserving true conversational pauses ($\ge 250\text{ ms}$).

### 3.3 Zero-Division & Edge Case Guardrails
- **Zero-duration input**: `total_duration_seconds == 0.0` immediately returns zeroed durations and `None` WPM without running frame strides.
- **Pure silence**: Validates `detected_speech_duration_seconds == 0.0`, `speech_activity_ratio == 0.0`, `leading_silence == total_duration`, `internal_gaps == []`.
- **Speech only**: Continuous speech returns `speech_activity_ratio == 1.0`, zero leading/trailing silence, zero internal gaps.
- **Micro-pauses**: Non-speech gaps $< 250\text{ ms}$ are filtered out of `internal_gaps` to avoid penalizing standard articulatory closures.

---

## 4. Test Coverage
Unit test suite: `backend/tests/test_acoustics.py` (12 tests covering all boundary conditions, zero-division, silence separation, gap detection, transcript derivation, and integration with `decode_audio`).
API integration test suite: `backend/tests/test_acoustics_api.py` (8 tests covering loopback guard, dev guard, path validation, persistence, and zero-speech scenarios).

---

## 5. API Service Layer & Persistence
- **Endpoints**: `POST` and `GET /api/sessions/{session_id}/recordings/{take_number}/acoustics` in `backend.api.v1.endpoints.acoustics`.
- **Off-Event-Loop Processing**: Audio decoding and frame RMS calculation run off the async event loop using `asyncio.to_thread` to preserve FastAPI concurrency.
- **Disk Persistence**: Results are persisted atomically as `acoustics_take_{take_number}.json` in the session's storage directory via `save_acoustics()`.
- **Loopback & Dev Guards**: Strict enforcement of `127.0.0.1`, `::1`, `localhost` origins and `ENVIRONMENT="development"`.

---

## 6. Frontend Integration & UI State Management
- **Hook**: `frontend/src/hooks/useAcoustics.ts` manages reactive states (`idle`, `analyzing`, `completed`, `failed`).
  - **Stale Take Rejection**: `activeTakeRef` tracks active take; late responses from previous takes are ignored.
- **UI Component**: `frontend/src/components/AudioPlayer.tsx` displays the **Audio Delivery Measurements** card upon completion:
  - Total recording duration vs. estimated speech-active duration.
  - Speech-activity percentage.
  - Separate leading and trailing silence.
  - Estimated words per minute (total speaking pace and active articulation rate) only when transcript is available.
  - Interactive collapsible internal non-speech gaps table ($\ge 250\text{ ms}$) showing interval boundaries and individual gap durations.
  - **Clickable Gap Playback**: Each gap item is rendered as a keyboard-accessible `<button>` that seeks the existing player to 0.75 seconds before `gap.start_seconds` (`Math.max(0, start - 0.75)`) and triggers playback, enabling the user to hear the surrounding speech context without overlapping audio.
  - **Precise Decimal Gap Timestamps**: Gap boundaries display in `mm:ss.SS` format (`formatTimestampPrecise`), calculated via integer-hundredths arithmetic to eliminate floating-point precision artifacts and guarantee short pauses do not display identical start and end values.
  - **Interactive Transcript Playback**:
    - **Word-Level Navigation**: When word timestamps are available from Whisper (`seg.words`), words render as interactive `<button className="transcript-word-btn">`.
    - **Lead-In Seeking**: Clicking seeks the single existing `<audio>` element to `Math.max(0, w.start - 0.25)` (250ms lead-in) and plays, capturing preceding phonetic consonant bursts.
    - **Active Playback Highlighting**: Real-time synchronization via `timeupdate` highlights the current word (`.transcript-word-active`) when `currentTime >= w.start && currentTime <= w.end`.
    - **Segment Fallback**: When word timestamps are absent, falls back to clickable segment phrase buttons (`.transcript-segment-inline-btn`) with active highlighting (`.transcript-segment-active`).
    - **Approximate Alignment Disclaimer**: Prominently labeled with `"Approximate Alignment"` badge and disclaimed in the Academic Integrity Notice (acknowledging Whisper cross-attention alignments are navigation aids, not phoneme-level ground truth).
    - **Safe Text Rendering**: All transcripts are rendered as standard React text nodes without HTML injection.
    - **Take Isolation**: All transcript highlights, words, and gaps reset synchronously when switching takes.
  - Pedagogical and scientific notices clarifying detector assumptions and disclaiming mock assessment scores.

