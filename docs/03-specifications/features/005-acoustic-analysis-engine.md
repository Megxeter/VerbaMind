# Feature Specification: Acoustic Analysis Engine (005)

## 1. Overview & Objective
The Acoustic Analysis Engine provides objective, physical measurements of speech timing, speech activity ratio, peripheral silence, internal non-speech gaps, and transcript-derived speaking rate from decoded speech audio.

---

## 2. Scientific & Architectural Invariants
1. **Decoupled Acoustic Measurements**:
   Acoustic metrics (speech duration, silence boundaries, non-speech gaps) are measured directly from decoded PCM waveforms and are strictly decoupled from linguistic accuracy (WER) and semantic relevance.
2. **Measurement, Not Judgment**:
   Detected internal gaps are physical acoustic intervals, **never automatically classified as errors or mistakes**. In natural human communication, pauses serve essential acoustic, physiological, and cognitive functions (inhalation, syntactic boundary demarcation, rhetorical emphasis, and cognitive planning).
3. **Transcript-Derived Speaking Rate**:
   Speaking rate (Words Per Minute / WPM) requires a recognised word count and is explicitly labeled as `rate_is_transcript_dependent = True`. Speaking rate is reported both as total pace (words per total minute) and active articulation rate (words per active speech minute).
4. **No Premature Scoring**:
   The engine does **not** generate arbitrary fluency scores (e.g., "78/100") or pronunciation grades. Filler word counting and rubric-based fluency scoring are strictly deferred to future increments.
5. **Zero Division & Boundary Safety**:
   The module handles empty audio arrays, pure digital silence, continuous tones/noise, and short clips without throwing arithmetic or indexing exceptions.

---

## 3. Acoustic Detector Specifications

| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| **Detector Type** | Short-Time Energy Root Mean Square (RMS) | Zero-dependency, deterministic frame-based energy detector. |
| **Sampling Frequency** | 16,000 Hz (mono float32) | Native sampling rate of the decoded audio pipeline. |
| **Frame Duration** | 25.0 ms (400 samples) | Standard acoustic window capturing short-term stationary spectral characteristics. |
| **Hop Duration** | 10.0 ms (160 samples) | 10 ms step providing 100 fps temporal resolution. |
| **Energy Scale** | dBFS ($20 \log_{10}(\text{RMS} + 10^{-7})$) | Logarithmic decibels relative to full scale ($0 \text{ dBFS} = 1.0$). |
| **Default Threshold** | -40.0 dBFS | Calibrated threshold separating typical room ambient noise from conversational voice. |
| **Hangover Window** | 150 ms (15 hops) | Bridges short intra-word unvoiced stop consonant closures (/p/, /t/, /k/) to prevent phoneme fragmentation. |
| **Min Speech Burst** | 80 ms (8 hops) | Rejects brief non-speech acoustic artifacts (clicks, mic pops). |
| **Min Gap Duration** | 250 ms (0.25 s) | Established phonetics threshold (Goldman-Eisler 1968) separating articulatory transitions (< 250ms) from silent pauses (>= 250ms). |

---

## 4. Derived Acoustic Measurements

### 4.1 Pure Waveform Measurements
- `total_duration_seconds`: Total duration of the decoded audio recording.
- `detected_speech_duration_seconds`: Total accumulated duration of active speech segments.
- `speech_activity_ratio`: Ratio of active speech time to total recording time ($\frac{\text{speech}}{\text{total}}$, range $0.0 - 1.0$).
- `leading_silence_seconds`: Non-speech duration before the onset of the first speech segment.
- `trailing_silence_seconds`: Non-speech duration from the offset of the final speech segment to the end of the recording.
- `internal_gaps`: Chronological list of non-speech intervals occurring strictly between speech segments with duration $\ge 250\text{ ms}$. Each gap records:
  - `start_seconds`: Timestamp of gap onset.
  - `end_seconds`: Timestamp of gap resolution.
  - `duration_seconds`: Net gap length.
- `internal_gap_count`: Count of internal non-speech gaps.
- `total_internal_gap_duration_seconds`: Net sum of internal gap durations.
- `mean_internal_gap_duration_seconds`: Average duration per internal gap (or 0.0 if count is 0).

### 4.2 Transcript-Derived Metrics
- `transcript_word_count`: Total word count extracted from transcript or passed explicitly.
- `words_per_minute_total`: $\frac{\text{word\_count}}{(\text{total\_duration\_seconds} / 60.0)}$
- `words_per_minute_speech_only` (Articulation Rate): $\frac{\text{word\_count}}{(\text{detected\_speech\_duration\_seconds} / 60.0)}$
- `rate_is_transcript_dependent`: Boolean flag explicitly indicating reliance on ASR transcription.

---

## 5. Verification Seams & API
- **Direct Array Interface**:
  ```python
  analyze_audio_array(
      audio_array: np.ndarray,
      sample_rate: int = 16000,
      transcript_text: str | None = None,
      word_count: int | None = None,
      energy_threshold_db: float = -40.0,
      min_gap_duration_seconds: float = 0.25,
  ) -> AcousticAnalysisResult
  ```
- **File Decoding Interface**:
  ```python
  analyze_audio_recording(
      source: Union[Path, str, BinaryIO, bytes],
      transcript_text: str | None = None,
      word_count: int | None = None,
  ) -> AcousticAnalysisResult
  ```
