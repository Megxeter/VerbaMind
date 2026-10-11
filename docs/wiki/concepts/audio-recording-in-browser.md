# Browser Audio Capture Mechanics

## 1. Web Audio & MediaRecorder Fundamentals
Modern web browsers provide two complementary APIs for interacting with microphone audio:

1. **`navigator.mediaDevices.getUserMedia({ audio: true })`**:
   - Accesses hardware audio input stream (`MediaStream`).
   - Requires user consent via the Permissions API.
   - Insecure origins (HTTP) block access except on `localhost`.

2. **`MediaRecorder`**:
   - Compresses raw PCM audio buffers into web-friendly container formats.
   - Common supported MIME types:
     - `audio/webm;codecs=opus` (Chrome, Firefox, Edge)
     - `audio/mp4` / `audio/aac` (Safari)
   - Emits `ondataavailable` events containing binary chunks (`Blob`).
   - On completion (`onstop`), chunks are concatenated into a final audio blob:
     ```typescript
     const audioBlob = new Blob(recordedChunks, { type: supportedMimeType });
     ```

3. **`AudioContext` & `AnalyserNode`**:
   - Used for live visualizer feedback without interfering with recording.
   - Extracts fast Fourier transform (FFT) or time-domain data (volume level / root mean square RMS) for reactive waveform or volume meters.

---

## 2. Permission States & Failure Modes
Handling microphone access gracefully is essential for a smooth user experience:

| State / Error | Cause | Remediation UI |
| :--- | :--- | :--- |
| `NotAllowedError` | User clicked "Deny" or blocked mic in browser address bar settings | Show clear banner: "Microphone access blocked. Click the lock/tune icon in your address bar to allow microphone." |
| `NotFoundError` | No microphone hardware device detected | Show banner: "No microphone detected. Please plug in a microphone or headset." |
| `NotReadableError` | Mic hardware is in exclusive use by another app (Zoom, Teams) | Show banner: "Microphone is busy. Please close other applications using audio." |
| `SecurityError` | Site loaded over non-HTTPS origin | Enforce HTTPS or run on `localhost`. |

---

## 3. Audio Storage & Memory Hygiene
- Audio blobs reside in browser RAM during an active session.
- To prevent memory leaks:
  - Revoke object URLs (`URL.revokeObjectURL(url)`) when unmounting components or discarding a take.
  - Close the `AudioContext` and stop all media stream tracks (`track.stop()`) when recording ends or component unmounts.
