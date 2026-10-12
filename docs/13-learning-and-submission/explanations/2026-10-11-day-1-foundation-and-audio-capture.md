# Engineering Deep Dive & Viva Preparation Guide — Day 1 (2026-10-11)

**Project Title**: VERBAMIND — AI-Assisted Placement Communication Coaching Platform  
**Target Audience**: B.Tech AI/ML Final Year Student, Project Guide, and External Viva Examiner  
**Document Type**: Architectural Explanation & Viva Defense Guide  
**Milestones Covered**: Milestone 1 (Voice Capture Studio) & Task 2.1 (FastAPI Foundation & Storage)  

---

## Table of Contents
1. [Executive Overview: What Was Built & What Remains](#1-executive-overview-what-was-built--what-remains)
2. [Codebase Organization & Key Files](#2-codebase-organization--key-files)
3. [Client-Side Audio Engineering & Hardware Lifecycle](#3-client-side-audio-engineering--hardware-lifecycle)
   - [3.1 Practice Passage Catalog](#31-practice-passage-catalog)
   - [3.2 Hardware Permission Lifecycle](#32-hardware-permission-lifecycle)
   - [3.3 MediaRecorder & Opus Chunk Buffering](#33-mediarecorder--opus-chunk-buffering)
   - [3.4 Real-Time Web Audio Frequency-Bin Averaging](#34-real-time-web-audio-frequency-bin-averaging)
   - [3.5 Resource Teardown & Hardware Lock Release](#35-resource-teardown--hardware-lock-release)
   - [3.6 Audio Playback & Scrubber Controls](#36-audio-playback--scrubber-controls)
4. [Backend Foundation & Network Architecture](#4-backend-foundation--network-architecture)
   - [4.1 Frontend-to-Backend Health Probing Loop](#41-frontend-to-backend-health-probing-loop)
   - [4.2 FastAPI Application Architecture](#42-fastapi-application-architecture)
   - [4.3 Strict CORS Policies & Limitations](#43-strict-cors-policies--limitations)
   - [4.4 Sanitized Exception Envelopes](#44-sanitized-exception-envelopes)
5. [Private Audio Storage Abstraction](#5-private-audio-storage-abstraction)
   - [5.1 Deep Seam Architecture (ABC vs Implementation)](#51-deep-seam-architecture-abc-vs-implementation)
   - [5.2 Path Traversal & Injection Defenses](#52-path-traversal--injection-defenses)
   - [5.3 Why Static File Serving Is Strictly Prohibited](#53-why-static-file-serving-is-strictly-prohibited)
6. [Testing Methodology: What Tests Establish & What They Do Not](#6-testing-methodology-what-tests-establish--what-they-do-not)
7. [Architectural Trade-offs & Current Limitations](#7-architectural-trade-offs--current-limitations)
8. [Comprehensive Viva Defense Q&A (14 Questions)](#8-comprehensive-viva-defense-qa-14-questions)

---

## 1. Executive Overview: What Was Built & What Remains

### What Was Built Today (Verified & Active)
1. **Client-Side Voice Recording Studio**:
   - Native browser audio capture using `navigator.mediaDevices.getUserMedia` and `MediaRecorder`.
   - Real-time 16-bar animated waveform visualizer powered by Web Audio `AnalyserNode`.
   - Hardware permission error handling with user remediation guidance.
   - Comprehensive recorder controls (Start, Pause, Resume, Stop, Retry) with a 180-second safety timeout.
   - Instant client-side audio player with scrub timeline and local `.webm` file download.
   - Catalog of 4 placement practice passages with target WPM and phonetic focus words.
2. **FastAPI Backend Foundation**:
   - Python 3.12 service managed cleanly via `uv` with reproducible lockfile (`uv.lock`).
   - Centralized typed configuration (`Pydantic BaseSettings`) validating origins and byte limits.
   - Health diagnostic probe (`GET /api/health`) returning server status, version, and ISO 8601 UTC timestamp.
   - Strict CORS whitelist restricting access to exact local frontend origins (`127.0.0.1:5173`).
   - Standardized error handlers shielding clients from server tracebacks and internal credentials.
   - Private audio storage abstraction (`LocalStorageService`) with path traversal defenses (`path.is_relative_to` and regex checks).
3. **Frontend Connection Monitoring**:
   - `useBackendStatus` hook with an `AbortController` timeout (2.5s) and automated 10-second polling.
   - Dynamic Header status badge rendering `API Online (v0.1.0)`, `API Offline`, or `API Connecting...`.
   - Live fault-injection verified: graceful transition to offline on backend shutdown, automatic recovery on restart.

### What Remains Unimplemented (Future Milestones)
- **Audio Upload API**: `POST /api/sessions/{session_id}/recording` (Scheduled for Task 2.2).
- **Speech-to-Text Pipeline**: OpenAI Whisper local transcription with word-level timestamps (Task 2.3).
- **Acoustic Analysis**: Librosa/PyAudioAnalysis pause density, speaking rate (WPM), and pitch metrics (Milestone 3).
- **Database Persistence**: User profiles, persistent sessions, and historical score tracking in PostgreSQL / SQLite.
- **Machine Learning Fluency Model**: Custom scoring model trained and evaluated on unseen speakers (Milestone 5).

---

## 2. Codebase Organization & Key Files

The project follows a clean separation between frontend presentation, backend services, and academic documentation:

```
VERBAMIND/
├── backend/
│   ├── pyproject.toml               # Python dependencies and uv build config
│   ├── uv.lock                      # Exact locked versions of backend packages
│   ├── src/backend/
│   │   ├── main.py                  # FastAPI factory, lifespan handler, CORS middleware
│   │   ├── api/v1/
│   │   │   ├── api.py               # Router aggregator
│   │   │   └── endpoints/
│   │   │       └── health.py        # GET /api/health endpoint
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic Settings (CORS origins, paths, size limits)
│   │   │   └── errors.py            # Global exception handlers (404, 422, 500)
│   │   └── services/
│   │       └── storage.py           # AudioStorageService ABC and LocalStorageService
│   └── tests/
│       ├── test_health.py           # Health endpoint assertions
│       ├── test_cors.py             # Origin whitelisting & rejection tests
│       ├── test_storage.py          # Storage persistence & path traversal defense tests
│       └── test_errors.py           # Error JSON sanitization tests
├── frontend/
│   ├── package.json                 # Node dependencies (React 19, TypeScript, Vitest)
│   ├── src/
│   │   ├── main.tsx                 # React DOM mount point
│   │   ├── App.tsx                  # Root application layout
│   │   ├── index.css                # Vanilla CSS design system (tokens, dark theme)
│   │   ├── data/
│   │   │   └── exercises.ts         # Practice passage catalog & metadata
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.ts  # MediaRecorder & Web Audio lifecycle hook
│   │   │   └── useBackendStatus.ts  # FastAPI health polling & offline status hook
│   │   └── components/
│   │       ├── Header.tsx           # Navigation header & backend connectivity badge
│   │       ├── ExerciseSelector.tsx # Passage selection tabs and card grid
│   │       ├── AudioVisualizer.tsx  # 16-bar animated waveform meter
│   │       ├── RecorderControls.tsx # Start / Pause / Resume / Stop button row
│   │       ├── AudioPlayer.tsx      # Audio preview player with seek bar and download
│   │       └── MicPermissionNotice.tsx # Permission denial banner with instructions
│   └── tests/                       # Vitest component & hook test suites
└── docs/                            # 13-part documentation architecture & wiki
```

---

## 3. Client-Side Audio Engineering & Hardware Lifecycle

### 3.1 Practice Passage Catalog
Located in [`frontend/src/data/exercises.ts`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/frontend/src/data/exercises.ts):
```typescript
export interface Exercise {
  id: string;
  title: string;
  category: 'hr' | 'technical' | 'situational';
  difficulty: 'easy' | 'medium' | 'hard';
  passage: string;
  targetWpm: number;
  expectedDurationSeconds: number;
  wordCount: number;
  keyPhrases: string[];
}
```
Each passage includes target words-per-minute (WPM) benchmarks (typically 125–140 WPM for technical clarity) and "key phrases" (e.g., *“Invalidation”*, *“Throughput”*). In subsequent milestones, phonetic alignment will specifically inspect these key phrases.

### 3.2 Hardware Permission Lifecycle
Located in [`frontend/src/hooks/useAudioRecorder.ts`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/frontend/src/hooks/useAudioRecorder.ts):
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
});
```
- **Browser Constraints**: When calling `getUserMedia`, we enable hardware echo cancellation, noise suppression, and auto gain control to eliminate acoustic background hum before encoding.
- **Error Remediation**: If the user denies microphone permission, the browser throws a DOMException `NotAllowedError`. The hook catches this, sets `permissionStatus = 'denied'`, and mounts [`MicPermissionNotice.tsx`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/frontend/src/components/MicPermissionNotice.tsx), instructing the user how to click the lock/tune icon in their browser address bar to re-enable the device.

### 3.3 MediaRecorder & Opus Chunk Buffering
When recording begins:
```typescript
const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
chunksRef.current = [];

mediaRecorder.ondataavailable = (event: BlobEvent) => {
  if (event.data && event.data.size > 0) {
    chunksRef.current.push(event.data);
  }
};
```
1. `MediaRecorder` compresses raw PCM audio from the microphone into an Opus-encoded container in browser memory.
2. Every time a chunk is ready, the `ondataavailable` handler appends it to an in-memory array (`chunksRef.current`).
3. When `mediaRecorder.stop()` triggers, the `onstop` callback combines the chunks into a unified `Blob`:
```typescript
const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
const audioUrl = URL.createObjectURL(audioBlob);
```
4. `URL.createObjectURL(audioBlob)` generates a synthetic URI (e.g., `blob:http://localhost:5173/5c50593d...`) enabling `<audio>` elements to stream the audio directly from memory.

### 3.4 Real-Time Web Audio Frequency-Bin Averaging
To provide responsive visual feedback without main-thread stutter, we route the live `MediaStream` into the Web Audio API:
```typescript
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
const source = audioContext.createMediaStreamSource(stream);
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
source.connect(analyser);
```
Inside a `requestAnimationFrame` loop:
```typescript
const buffer = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(buffer);

// Compute arithmetic mean magnitude across frequency bins
let sum = 0;
for (let i = 0; i < buffer.length; i++) {
  sum += buffer[i];
}
const average = sum / buffer.length;
const normalizedVolume = Math.min(100, Math.round((average / 128) * 100));
```
#### Technical Clarification: Frequency-Bin Averaging vs. Root Mean Square (RMS)
It is crucial to note that this visualizer computation is **frequency-bin averaging**, not RMS:
- **Frequency-Bin Averaging**: Extracts spectral magnitude bins $M_k \in [0, 255]$ from the Fast Fourier Transform (FFT) output via `analyser.getByteFrequencyData()`. It averages these magnitude bins ($\bar{M} = \frac{1}{K}\sum_{k=0}^{K-1} M_k$) and scales linearly to $0\text{–}100$. This reflects the spectral spread of human speech energy across the 128 bins ($0\text{ to }\approx 24\text{ kHz}$) and is computationally negligible at 60 FPS.
- **Root Mean Square (RMS)**: Calculated strictly in the **time domain** on raw PCM instantaneous pressure amplitudes $x_i$:
  $$\text{RMS} = \sqrt{\frac{1}{N}\sum_{i=1}^N x_i^2}$$
  RMS measures overall physical electrical/acoustic power, requires `getByteTimeDomainData` or `getFloatTimeDomainData`, and involves square-root operations.

Our visualizer deliberately employs frequency-bin averaging because it directly captures vocal formant activity across conversational frequency bands while minimizing per-frame CPU load.

### 3.5 Resource Teardown & Hardware Lock Release
A common bug in voice web applications is leaving the microphone stream active after recording ends, draining the user's battery and triggering browser privacy warnings.
Our `releaseStream()` function handles this cleanly:
```typescript
const releaseStream = () => {
  if (animationFrameRef.current) {
    cancelAnimationFrame(animationFrameRef.current);
  }
  if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
    audioContextRef.current.close();
  }
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }
};
```
Calling `track.stop()` releases the operating system hardware microphone lock immediately. Additionally, when a recording is discarded or replaced, `URL.revokeObjectURL(audioUrl)` is invoked to prevent browser heap memory leaks.

### 3.6 Audio Playback & Scrubber Controls
Located in [`frontend/src/components/AudioPlayer.tsx`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/frontend/src/components/AudioPlayer.tsx):
- Mounts an HTML5 `<audio>` element linked to the synthetic blob URL.
- Exposes play/pause toggle, current playback timestamp / total duration, and a scrub slider bound to `audio.currentTime`.
- Provides a "Download Audio" anchor tag with `download="verbamind-take-1.webm"` so the user can inspect or archive their local audio file.

---

## 4. Backend Foundation & Network Architecture

### 4.1 Frontend-to-Backend Health Probing Loop
Located in [`frontend/src/hooks/useBackendStatus.ts`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/frontend/src/hooks/useBackendStatus.ts):
```typescript
const checkHealth = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
    });
    if (response.ok) {
      const data: HealthResponse = await response.json();
      setStatus({ isOnline: true, version: data.version, isLoading: false });
    } else {
      setStatus({ isOnline: false, version: null, isLoading: false });
    }
  } catch {
    setStatus({ isOnline: false, version: null, isLoading: false });
  } finally {
    clearTimeout(timeoutId);
  }
};
```
- **Fault-Tolerant Timeout**: Uses an `AbortController` capped at 2,500ms to avoid blocking frontend rendering if the backend server hangs.
- **Polling Loop**: An interval re-probes every 10 seconds.
- **UI State**: Feeds into [`Header.tsx`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/frontend/src/components/Header.tsx) to render a green `● API Online (v0.1.0)` or red `● API Offline` indicator.

### 4.2 FastAPI Application Architecture
Located in [`backend/src/backend/main.py`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/backend/src/backend/main.py):
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing VERBAMIND API...")
    yield
    logger.info("Shutting down VERBAMIND API...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)
```
- **Lifespan Manager**: Uses modern Starlette `lifespan` context management instead of deprecated `@app.on_event("startup")` decorators.
- **Modular Routers**: `backend/api/v1/api.py` aggregates domain routers under the `/api` prefix.
- **Health Route**: [`backend/src/backend/api/v1/endpoints/health.py`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/backend/src/backend/api/v1/endpoints/health.py) returns an ISO 8601 UTC timestamp:
```python
@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.ENVIRONMENT,
    )
```

### 4.3 Strict CORS Policies & Limitations
Configured in [`backend/src/backend/core/config.py`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/backend/src/backend/core/config.py) and registered in `main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
```
- **Strict Origin Whitelist**:
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`
  - `http://127.0.0.1:4173`
  - `http://localhost:4173`
- **Security Rule**: Wildcards (`*`) are explicitly avoided. This ensures unauthorized third-party origins cannot instruct a user's browser to read local development endpoints or exfiltrate private audio streams.
- **Accurate Boundaries & Limitations of CORS**:
  - **CORS is NOT Authentication**: CORS is enforced strictly by browsers to restrict cross-origin JavaScript reads under the Same-Origin Policy. Non-browser clients (such as `curl`, Postman, or automated Python scripts) do not enforce CORS headers and can contact API endpoints directly.
  - **CORS is NOT a Complete CSRF Defense**: Simple cross-origin requests (such as standard HTML form submissions) do not trigger preflight `OPTIONS` checks and can still reach the server. True CSRF defense requires anti-CSRF tokens, SameSite cookie policies, and origin/referer verification on state-changing operations.

### 4.4 Sanitized Exception Envelopes
Configured in [`backend/src/backend/core/errors.py`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/backend/src/backend/core/errors.py):
```python
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail if isinstance(exc.detail, str) else "Request error",
            }
        },
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    simplified_errors = [
        {"field": " -> ".join(str(i) for i in err.get("loc", [])), "issue": err.get("msg", "Invalid parameter")}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "The request payload failed validation.",
                "details": simplified_errors,
            }
        },
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled server exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
            }
        },
    )
```
- **Zero Information Leakage**: Prevents internal system details (e.g., database connection strings, local absolute file paths, Python tracebacks) from being exposed to the client in production responses.
- Registered against `StarletteHTTPException` (404/400), `RequestValidationError` (422), and base `Exception` (500).

---

## 5. Private Audio Storage Abstraction

### 5.1 Deep Seam Architecture (ABC vs Implementation)
Defined in [`backend/src/backend/services/storage.py`](file:///c:/Users/yasir/OneDrive/Desktop/VERBA%20MIND/backend/src/backend/services/storage.py):
```python
class AudioStorageService(ABC):
    @abstractmethod
    async def save_recording(
        self, session_id: str, file_name: str, audio_bytes: bytes
    ) -> Path:
        """Saves raw audio bytes for a given session."""
        pass
```
By isolating disk persistence behind this Abstract Base Class, upstream application logic (e.g., upload endpoints, ML workers) interacts only with the abstract interface. If we migrate from local disk storage to cloud storage (e.g., AWS S3 or MinIO) later, we only need to implement an `S3StorageService` without altering upstream business logic.

### 5.2 Path Traversal & Injection Defenses
In `LocalStorageService`:
```python
SESSION_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-]+$")

def _validate_session_id(self, session_id: str) -> None:
    if not self.SESSION_ID_REGEX.match(session_id):
        raise ValueError(f"Invalid session ID format: '{session_id}'")

async def save_recording(self, session_id: str, file_name: str, audio_bytes: bytes) -> Path:
    self._validate_session_id(session_id)
    if len(audio_bytes) > self.max_file_size_bytes:
        raise ValueError(f"Audio payload exceeds limit of {self.max_file_size_bytes} bytes")

    destination_dir = (self.base_dir / session_id).resolve()
    if not destination_dir.is_relative_to(self.base_dir.resolve()):
        raise ValueError("Directory traversal attempt detected.")
    ...
```
- **Layer 1 (Regex Whitelist)**: Rejects any character outside `[a-zA-Z0-9_-]`, immediately filtering out navigation patterns like `../` or `..\`.
- **Layer 2 (Canonical Path Traversal Check)**: Uses Python 3.9+ `path.resolve()` and `path.is_relative_to()`. If the resolved path points outside `storage/recordings/`, a `ValueError` is raised immediately.
- **Layer 3 (Byte Size Guardrail)**: Rejects payloads exceeding 15 MB (15,728,640 bytes) to prevent memory exhaustion attacks.

### 5.3 Why Static File Serving Is Strictly Prohibited
Audio recordings contain private user voice data. Mounting the storage directory to Starlette's `StaticFiles` router would expose recordings directly at predictable URLs (e.g., `/static/recordings/session_1/take_1.webm`).
In VERBAMIND:
- The storage directory is kept outside public web roots.
- Audio access will require authenticated application endpoints that verify session ownership before streaming bytes.

---

## 6. Testing Methodology: What Tests Establish & What They Do Not

| Test Category | Suite / Tool | What It Establishes | What It Does NOT Establish |
| :--- | :--- | :--- | :--- |
| **Backend Unit Tests** | `pytest` (10 tests) | Schema compliance of `/api/health`, origin header filtering, path traversal exception triggering, size caps, and sanitized error JSON structures. | Does not establish database persistence, multi-user concurrency under high load, or physical cloud storage reliability. |
| **Frontend Unit / Component Tests** | `vitest` (19 tests) | Component mounting, button state transitions, simulated permission denial display, timer increments, and mock stream cleanup. | Does not guarantee real physical microphone hardware fidelity or OS-level audio device permissions across different browsers. |
| **Static & Type Compilation** | `tsc -b && vite build` | Type safety between components, absence of syntax errors, and successful production asset bundle generation. | Does not guarantee runtime network connectivity between frontend and backend. |
| **Live Fault-Injection Tests** | Daemon kill & restart | Frontend gracefully transitions to `API Offline` badge upon server termination and recovers to `API Online` without manual page reload. | Does not simulate network packet loss, intermittent latency, or complex reverse proxy timeouts (e.g. Nginx). |
| **User Manual Checks** | Browser runtime verification | Physical microphone captures sound, audio visualizer animates with voice pressure, and recorded `.webm` plays back without distortion. | Does not provide automated regression protection for future code commits. |

---

## 7. Architectural Trade-offs & Current Limitations

1. **Client-Side WebM (Opus) vs PCM WAV**:
   - *Decision*: Record in `audio/webm;codecs=opus` on the client.
   - *Trade-off*: Opus provides excellent compression (~300 KB for 1 minute vs ~10 MB for uncompressed WAV), keeping network transfers fast.
   - *Limitation*: PyTorch/Librosa acoustic analysis requires 16 kHz mono WAV. The backend will need an `ffmpeg` / `pydub` transcoding step during Task 2.2 before acoustic feature extraction.
2. **Local Disk Storage vs Cloud Object Storage (S3)**:
   - *Decision*: Implemented `LocalStorageService` for Day 1 development.
   - *Trade-off*: Avoids AWS cloud credentials and network latency during local development.
   - *Limitation*: Local storage does not scale horizontally across multiple web server instances without a distributed filesystem (e.g., NFS).
3. **Polling vs WebSockets for Health Status**:
   - *Decision*: HTTP polling at 10-second intervals with `AbortController`.
   - *Trade-off*: Extremely simple, stateless, and reliable; no persistent socket connection overhead.
   - *Limitation*: Changes in status have a latency of up to 10 seconds before appearing on the frontend.
4. **Mock Assessment Scores Strictly Prohibited**:
   - *Decision*: We do not display mock or hardcoded fluency scores on the frontend.
   - *Trade-off*: The interface currently ends at audio playback and review until backend analysis pipelines are built.
   - *Academic Invariant*: Preserves scientific and research integrity by avoiding fabricated metrics.

---

## 8. Comprehensive Viva Defense Q&A (14 Questions)

### Q1: Why did you choose `MediaRecorder` rather than WebRTC?
> **Answer**: `MediaRecorder` is the standardized browser API for local media stream capture and encoding. It compresses raw audio into efficient containers (WebM/Opus) directly in browser memory and emits chunks asynchronously. WebRTC is designed for low-latency peer-to-peer live teleconferencing across a network, which requires ICE servers, STUN/TURN, and SDP signaling. Using WebRTC for single-user recording would introduce unnecessary network overhead and architectural complexity.

### Q2: How does your audio visualizer compute volume levels in real time?
> **Answer**: We route the active `MediaStream` into a Web Audio `AudioContext` and connect it to an `AnalyserNode`. Using Fast Fourier Transform (FFT) analysis with an `fftSize` of 256, we extract frequency bin data into a `Uint8Array`. By calculating the arithmetic mean magnitude across the frequency bins (frequency-bin averaging) and normalizing it onto a 0–100 scale on every `requestAnimationFrame`, we achieve a smooth 60 FPS reactive waveform with minimal main-thread CPU overhead. Note that this is frequency-bin averaging across spectral bins, not time-domain root mean square (RMS) amplitude calculation.

### Q3: How do you guarantee the microphone does not stay active after the user clicks Stop?
> **Answer**: In our `useAudioRecorder` hook, the `releaseStream()` function loops over all audio tracks in the `MediaStream` (`stream.getTracks()`) and calls `track.stop()`. It also closes the Web Audio `AudioContext` and cancels the animation frame request. Calling `track.stop()` explicitly releases the hardware lock at the operating system level, which clears the browser's recording indicator.

### Q4: Why must acoustic fluency be separated from reading accuracy and pronunciation?
> **Answer**: Conflating these three dimensions is a fundamental flaw in naive speech evaluation tools:
> - **Acoustic Fluency**: Measures temporal rhythm, speaking rate (WPM), articulation rate, and pause distribution.
> - **Reading Accuracy**: Measures lexical fidelity against the reference text via Word Error Rate (WER).
> - **Pronunciation**: Measures phonetic intelligibility at the individual phoneme level (e.g. Goodness of Pronunciation GoP).
> **Critical Academic Invariant: Reading accuracy does NOT establish pronunciation**. A candidate reading aloud can achieve 100% Reading Accuracy (0% WER) by speaking every word in the script, yet pronounce phonemes incorrectly, misplace stress, or speak with unintelligible phonetics. Conversely, an ASR transcript might decode a word correctly despite flawed phonetic execution. Decoupling acoustic cadence, textual accuracy, and phonetic clarity is mandatory for scientifically sound diagnostic feedback.

### Q5: What was the Starlette test warning you encountered, and how did you resolve it?
> **Answer**: When running pytest, Starlette 1.7.0 emitted `StarletteDeprecationWarning: Using 'httpx' with 'starlette.testclient' is deprecated; install 'httpx2' instead.` Starlette's `TestClient` recently introduced an internal preference for `httpx2`. Rather than suppressing the warning via pytest flags, we resolved it at the dependency level by adding `httpx2` to our development dependencies in `pyproject.toml`. Pytest now passes with 0 warnings.

### Q6: Why did you avoid wildcard CORS (`allow_origins=["*"]`)?
> **Answer**: A wildcard origin permits any arbitrary website loaded in a user's browser to read responses from our API endpoints. Since our backend will manage private user audio recordings, allowing unauthorized origins could enable malicious web pages to exfiltrate session data or read audio payloads. We explicitly restrict origins to our exact local frontend (`http://127.0.0.1:5173`). However, we recognize that **CORS is neither authentication nor a complete CSRF defense**: it only restricts browser-based JavaScript cross-origin response reading, does not protect against non-browser clients (such as curl or scripts), and does not block simple cross-origin form submissions. Full security requires dedicated authentication tokens, SameSite cookie attributes, and session authorization.

### Q7: How does your backend prevent Directory Traversal attacks in audio storage?
> **Answer**: Our `LocalStorageService` applies defense-in-depth:
> 1. Validates the session ID against a strict regex whitelist (`^[a-zA-Z0-9_\-]+$`), rejecting path separators like `/`, `\`, or `..`.
> 2. Resolves the target directory using `path.resolve()` and asserts `path.is_relative_to(base_storage_dir)`. If the path attempts to break out of the designated folder, a `ValueError` is raised before any file operations occur.

### Q8: Why are recordings not served through a static file directory?
> **Answer**: Serving user voice recordings through static routes (e.g. `/static/recordings/{session_id}/take_1.webm`) makes files accessible to anyone with a guessed URL, bypassing authentication and session ownership checks. In VERBAMIND, recordings are stored in a private directory and will only be accessible via authenticated application endpoints.

### Q9: What happens if the backend crashes while the user is using the website?
> **Answer**: The frontend's `useBackendStatus` hook periodically polls `/api/health` using an `AbortController` timeout (2.5s). If the backend crashes, the fetch request fails gracefully without unhandled promise rejections, and the Header status badge dynamically switches from green `API Online` to red `API Offline`. When the backend recovers, the next poll automatically detects it and transitions the badge back to `API Online`.

### Q10: Why did you use `uv` instead of standard `pip` and `requirements.txt`?
> **Answer**: `uv` is a modern Python package and project manager built in Rust. It offers:
> 1. Deterministic dependency resolution via `uv.lock`, ensuring every developer and CI runner uses the exact same package versions.
> 2. Package installation speeds 10–100× faster than traditional `pip`.
> 3. Standardized `pyproject.toml` configuration following modern Python packaging standards (PEP 517/621).

### Q11: What is the purpose of the 180-second safety timeout on recording?
> **Answer**: In client-side audio recording, uncompressed or compressed audio chunks accumulate in browser memory. If a user starts recording and forgets to stop it, the memory buffer would grow indefinitely, leading to tab crashes or memory leaks. The 180-second duration cap automatically stops the recorder and flushes the buffer to an audio blob, protecting browser memory.

### Q12: How does the backend sanitize internal exceptions?
> **Answer**: We registered custom exception handlers in `backend/core/errors.py`. When an unhandled 500 error occurs, the server logs the full stack trace internally for debugging, but returns a generic `INTERNAL_SERVER_ERROR` JSON payload to the client. This prevents internal implementation details, such as database credentials or file paths, from leaking to end users.

### Q13: What is the difference between a Blob and an Object URL in the frontend?
> **Answer**: A `Blob` (Binary Large Object) is an immutable representation of raw binary data in browser memory. An Object URL (`URL.createObjectURL(blob)`) is a temporary synthetic URL string generated by the browser that references that in-memory Blob. This allows standard HTML tags (such as `<audio src="...">` or `<a href="..." download>`) to stream or download binary data without sending it to a server first.

### Q14: What is the purpose of the `AudioStorageService` Abstract Base Class (ABC)?
> **Answer**: It defines a deep architectural seam. Domain logic (such as session upload endpoints) depends strictly on the interface (`save_recording`, `get_recording_path`), rather than a concrete filesystem implementation. This makes our code easy to unit test using mock adapters and allows us to swap `LocalStorageService` for a cloud adapter like `S3StorageService` in the future without modifying any business logic.
