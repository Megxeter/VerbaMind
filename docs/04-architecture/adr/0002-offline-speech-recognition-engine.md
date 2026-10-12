# ADR 0002: Offline Speech Recognition Engine via faster-whisper (CTranslate2) & PyAV

- **Status**: Accepted & Implemented (Task 2.3A)
- **Date**: 2026-10-12
- **Deciders**: B.Tech AI/ML Project Team
- **Consulted**: Project Engineering Guidelines (`AGENTS.md`)

---

## 1. Context & Problem Statement

VERBAMIND requires automated, offline speech-to-text transcription with word-level timestamps to power subsequent Reading Accuracy (Word Error Rate) and Fluency analysis (speech rate, pause boundaries).

### Non-Negotiable Project Invariants
1. **Zero External Inference APIs**: No remote audio transfers to third-party cloud services (OpenAI, Google Cloud, AssemblyAI). Audio processing must run locally within the user's environment.
2. **Scientific & Academic Integrity**:
   - This task integrates a **pretrained acoustic/linguistic speech recognizer** (`Systran/faster-whisper-base.en`).
   - It does **not** represent custom fluency model training; training or fine-tuning specialized acoustic/fluency evaluation models remains designated for future research phases.
   - Recognizer token probabilities are internal acoustic confidence scores, **never** to be conflated with pronunciation clarity or fluency metrics.
3. **Passage Independence (Unbiased Recognition)**:
   - The reference passage must **never** be supplied to the speech recognizer as an `initial_prompt`, prefix, or hotword hint.
   - Supplying the passage would artificially bias the beam search, concealing reader mispronunciations, omissions, or word substitutions that our downstream evaluation engine must objectively measure.

---

## 2. Decision: faster-whisper (CTranslate2) with PyAV Decoding

We select **faster-whisper** (built on OpenNMT's CTranslate2 inference engine) and **PyAV** for local audio decoding:

1. **CTranslate2 Runtime**:
   - Re-implements OpenAI Whisper architecture in C++ with customized weight quantization (int8).
   - Up to 4x faster and consumes significantly less memory than vanilla PyTorch Hugging Face implementations.
2. **Hardware Target & Model Tier**:
   - Default: `base.en` on **CPU** using **int8** quantization (`cpu_threads=4`).
   - System measurements on our 16-core AMD Ryzen machine show an inference Real-Time Factor (RTF) of **0.10x** (processing a 47-second recording in ~4.68 seconds).
   - Model memory footprint is ~140 MB, leaving system memory unburdened.
   - Compute device (`cpu` / `cuda`) and precision (`int8` / `float16`) remain fully configurable via `Settings`.
3. **Audio Decoding Layer (PyAV)**:
   - Uses PyAV (FFmpeg C bindings) to decode streaming WebM/Opus, WAV, and Ogg containers into 16 kHz mono float32 numpy arrays.
   - Enforces strict bounded decoding ($\le 180$ seconds) to protect server resources.
4. **Local Isolated Model Caching**:
   - Model weights (`model.bin`, `config.json`, `tokenizer.json`, `vocabulary.txt`) are downloaded from the official repository (`Systran/faster-whisper-base.en`) into `models/whisper/base.en/`.
   - The directory is strictly ignored by Git.
   - Models are loaded with `local_files_only=True` to guarantee zero network communication during runtime.

---

## 3. Consequences & Tradeoffs

### Positive
- **High Throughput & Low Latency**: 10x faster than real-time execution on CPU without requiring GPU drivers or cuDNN installations.
- **Word-Level Timestamp Precision**: Produces start and end timestamps for every recognized word token.
- **Privacy & Compliance**: Zero cloud audio transmission; transcripts saved directly into server-controlled private directories.

### Limitations & Tradeoffs
- **Domain-Specific Proper Nouns**: The English-only base model (`base.en`) has a compact vocabulary and may occasionally substitute uncommon proper nouns (for example, recognizing the proprietary project name "VerbaMind" as "global mind").
- **Language Scope**: `base.en` is restricted to English. Multilingual evaluation would require larger models (`small` or `medium`).
