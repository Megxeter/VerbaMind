# Research Notes: Offline Speech Recognition via faster-whisper (CTranslate2)

**Topic**: Pretrained Acoustic/Linguistic Modeling for Automated Speech Coaching  
**Phase**: Milestone 2 — Task 2.3A  
**Date**: 2026-10-12  

---

## 1. Research Motivation & Invariant Principles

In automated placement communication coaching, accurate speech transcription is a prerequisite for linguistic evaluation (Word Error Rate, vocabulary tiering, and filler word detection). However, commercial speech coaching platforms often rely on remote cloud APIs (OpenAI Whisper API, AWS Transcribe), violating student data privacy and academic reproducibility.

### Core Scientific Invariants
1. **Integration vs Training**:
   - This increment integrates a **pretrained foundation model** (`faster-whisper-base.en`).
   - It does **not** constitute training our own fluency or acoustic evaluation models. Training custom scoring models on annotated speech corpora remains future research work.
2. **Confidence vs Fluency Separation**:
   - Whisper decoder outputs token softmax probabilities ($P(\text{token} \mid \text{acoustic frames}, \text{context})$).
   - These probabilities represent the model's confidence in linguistic transcription, **not** human pronunciation intelligibility (which requires acoustic Goodness of Pronunciation / GoP) or delivery fluency (which requires acoustic pause/rate metrics).
3. **Prevention of Confirmation Bias**:
   - Passing the expected reading passage into Whisper's `initial_prompt` causes the decoder to act as a biased language model prior, hallucinating missed words and masking genuine reader errors.
   - For objective reading assessment, transcription **must remain prompt-independent**.

---

## 2. Experimental Benchmark Results (AMD Ryzen 7, 16 Cores, CPU int8)

A real user speech recording (`take_1.webm`, 47.16 seconds) was decoded and transcribed using the offline service:

| Metric | Measured Value | Analysis |
| :--- | :--- | :--- |
| **Audio Duration** | 47.16 seconds | WebM/Opus container, 48 kHz mono |
| **PyAV Decoding Time** | 0.100 seconds | Resampled to 16 kHz mono float32 |
| **Model Size** | 138.49 MB | `base.en` CTranslate2 int8 weights |
| **Model Load Time** | 0.69 seconds | Lazy load from local directory |
| **Inference Processing Time** | 4.688 seconds | 4 CPU threads |
| **Real-Time Factor (RTF)** | **0.10x** | **10.1x faster than real-time playback** |
| **Segment Count** | 8 segments | Natural pause-delimited boundaries |
| **Word Timestamps** | 96 words | Sub-second start/end timestamps |
| **Language Confidence** | 1.000 (English) | High confidence |

---

## 3. Findings & Limitations

1. **Phonetic vs Vocabulary Substitutions**:
   - The recognized transcript achieved high semantic accuracy across the technical introduction passage.
   - Minor proper noun substitution was observed (the novel compound name "VerbaMind" was transcribed as "global mind"), which is characteristic of compact vocabulary base models without custom language model adaptation.
2. **Timestamp Alignment Precision**:
   - Dynamic Time Warping (DTW) cross-attention matrices in `faster-whisper` provide accurate word boundaries without requiring external forced aligners (such as Montreal Forced Aligner).
   - This provides the necessary foundation for subsequent pause duration and speech rate calculations in Task 2.3B.

---

## 4. Empirical Model Comparison: `base.en` vs `small.en`

### A. Context & Investigation
Manual review of user evidence for `Take #1` revealed specific ASR substitution errors:
- Speaker's name (`"Yasir"`) misrecognised by `base.en` as `"Yasa"`.
- Novel compound name (`"VerbaMind"`) misrecognised as `"global mind"`.
- Phrase (`"final year"`) misrecognised as `"finally a"`.

To evaluate whether scaling model parameters improves acoustic resolution without remote APIs, we downloaded official `Systran/faster-whisper-small.en` weights (244M parameters, 483.5 MB) and evaluated both models on the identical audio file (`take_1.webm`, 47.16s) using local CPU int8 inference (4 threads, `initial_prompt=None`).

### B. Comparative Experimental Results

| Parameter / Metric | `base.en` | `small.en` | Empirical Observation |
| :--- | :---: | :---: | :--- |
| **Model Parameters** | ~74 Million | ~244 Million | ~3.3x parameter capacity |
| **Quantized Weights Size**| 138.49 MB | 483.54 MB | Both fit easily in local host RAM |
| **Inference Time (CPU int8)**| **4.58 seconds** | **9.82 seconds** | ~2.1x latency increase, but still ~5x faster than real-time (RTF: 0.208x) |
| **Real-Time Factor (RTF)**| **0.097x** | **0.208x** | Highly practical for interactive coaching |
| **Speaker Name Recognition**| `"Yasa"` | **`"Yasir"`** | `small.en` correctly resolved the proper noun without biasing prompts |
| **Academic Year Phrase**| `"finally a"` | **`"final year"`** | `small.en` resolved the acoustic consonant transition |
| **Platform Name Resolution**| `"global mind"` | **`"verbal mind"`** | `small.en` produced a phonetic transcription (`"verbal mind"`) close to the un-indexed term `"VerbaMind"` |
| **Overall Word Count** | 96 words | 96 words | Perfect temporal segment parity |

### C. Critical Limitations & Scientific Boundaries
1. **Not a General Benchmark**: This single-file observation is a developmental quality comparison, not a statistically generalized ASR accuracy benchmark.
2. **No Pronunciation Inference**: ASR substitutions (e.g., base.en emitting "Yasa" or "finally a") are **model recognition limitations**, NOT user pronunciation errors. In our architecture, pronunciation evaluation requires phonetic posterior analysis (GoP), which is strictly separated from ASR word recognition.
3. **Prompt Biasing Invariant**: We preserve raw model outputs and strictly forbid passing reference scripts into `initial_prompt`, which would mask ASR deficits through hallucinated prior confirmation.

