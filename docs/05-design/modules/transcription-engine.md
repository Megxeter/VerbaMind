# Module Low-Level Design: Offline Audio Decoding & Transcription Engine (LLD)

**Modules**: `backend.services.audio_decoder`, `backend.services.transcription`, `backend.cli.transcribe`  
**Phase**: Milestone 2 — Task 2.3A  
**Status**: Implemented & Verified  

---

## 1. Architectural Seams & Interfaces

```
┌────────────────────────────────────────────────────────────────────────┐
│                   AUDIO DECODING & TRANSCRIPTION SEAMS                 │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│ Seam / Interface    │ Concrete Implementation  │ Scope & Leverage      │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ `decode_audio`      │ PyAV AudioResampler      │ WebM/Opus & WAV to    │
│                     │ (`services.audio_decoder`│ 16kHz mono float32,   │
│                     │                          │ bounded duration cap  │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ `Transcription      │ faster-whisper (CTrans-  │ C++ int8 CPU infer-   │
│  Service`           │ late2 WhisperModel)      │ ence, word timestamps,│
│                     │ (`services.transcription`│ atomic JSON storage   │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ `transcribe` CLI    │ argparse CLI runner      │ Offline test harness, │
│                     │ (`cli.transcribe`)       │ RTF benchmarking      │
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

---

## 2. Audio Decoding Pipeline (`backend.services.audio_decoder`)

The decoder accepts diverse audio formats without relying on system `ffmpeg` binaries:
1. **Container Opening**: `av.open()` parses streaming container metadata.
2. **Audio Stream Extraction**: Isolates primary audio stream; records native sample rate, channels, and codec name.
3. **Resampling & Channel Mixdown**: `av.AudioResampler` resamples directly to `16000 Hz`, `mono`, `fltp` (float 32-bit planar).
4. **Duration Bounding**: An incremental sample accumulator enforces `max_duration_sec` ($\le 180$ seconds). If decoded samples exceed this threshold, `AudioDurationExceededError` is raised immediately.
5. **Amplitude Normalization**: Combines decoded chunks and applies `np.clip(audio_data, -1.0, 1.0)` to guarantee valid input bounds for the acoustic model.

---

## 3. Offline Transcription Service (`backend.services.transcription`)

### A. Pretrained Model Isolation
- **Model Target**: `Systran/faster-whisper-base.en` (~138.5 MB, ~74M parameters).
- **Execution**: CTranslate2 engine running on CPU with 4 threads and int8 quantization.
- **Offline Constraint**: `local_files_only=True` enforces zero external network requests. If `model.bin` is missing, `ModelNotFoundError` is raised.

### B. Prompt Independence Invariant
- The service explicitly sets `initial_prompt=None`.
- **Rationale**: The reference passage must never be passed to the model as a prompt or hotword hint. Unbiased transcription is mandatory so downstream metrics (WER) can objectively compare recognized speech against the passage.

### C. Data Schemas
```python
class WordTiming(BaseModel):
    word: str
    start: float
    end: float
    probability: float  # Invariant: Decoder confidence, NOT pronunciation/fluency score

class SegmentTiming(BaseModel):
    id: int
    seek: int
    start: float
    end: float
    text: str
    words: list[WordTiming]

class TranscriptionResult(BaseModel):
    text: str
    segments: list[SegmentTiming]
    language: str
    language_probability: float
    duration_seconds: float
    processing_time_seconds: float
    model_name: str
    device: str
    compute_type: str
    word_count: int
    created_at: str
```

### D. Private Storage Persistence
- Transcripts are saved to `storage/recordings/{session_id}/transcript_take_{take_number}.json`.
- Uses an isolated `.tmp` file followed by `os.replace` to guarantee atomic persistence.
- The directory is Git-ignored and kept outside public static routes.

---

## 4. Background Worker & Bounded Queue (`backend.services.transcription_worker`)

### A. Non-Blocking Event Loop Guarantee
Faster-Whisper CPU inference is compute-intensive and blocking. To prevent freezing FastAPI's `asyncio` event loop:
1. All decoding and inference work is executed inside Python's worker thread pool via `asyncio.to_thread(self._service.transcribe_file, job.audio_path)`.
2. HTTP requests return immediately with `202 Accepted` (or `200 OK` if already completed).

### B. Bounded Queue & Single Worker Concurrency
1. **Queue Capacity**: Initialized with `asyncio.Queue(maxsize=5)`.
2. **Backpressure**: When the queue is full, `submit_job()` raises `TranscriptionQueueFullError`, translated by the API into `503 Service Unavailable`.
3. **Single Inference Worker**: Exactly one background task consumer (`_worker_loop`) processes jobs sequentially. This eliminates CPU thread thrashing and memory spikes on developer machines.

### C. Duplicate Protection
1. Jobs are keyed by `(session_id, take_number)` in `self._jobs`.
2. If a user clicks "Transcribe" multiple times or submits rapid requests while a job is `queued` or `processing`, the existing job is returned immediately without creating a redundant task or corrupting queue state.

### D. Restart Durability & Lifecycle
1. Started cleanly at server startup via FastAPI `lifespan` handler.
2. Graceful drain/cancellation on shutdown.
3. In-flight jobs (`queued` / `processing`) are strictly in-memory and do not survive a server restart. If interrupted, the client timeout allows a safe user retry.
4. Completed transcripts (`transcript_take_{take_number}.json`) are persistent and loaded from disk upon query.

