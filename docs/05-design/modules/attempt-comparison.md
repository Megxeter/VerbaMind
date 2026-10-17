# Module Design: Same-Exercise Attempt Comparison Engine

## 1. Module Overview
The Attempt Comparison module provides stateful attempt retention, compatibility evaluation, side-by-side metric arithmetic, and unified single-player audio auditioning within the client browser session.

---

## 2. Architecture & Seam Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│                               App.tsx                                  │
│  • Manages selectedExercise, takeNumber, sessionId                     │
│  • Holds useAttemptComparison() state                                  │
│  • Displays persistent baseline notification during recording/pause    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         Props: baselineAttempt,
                         onSetBaseline, onClearBaseline
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            AudioPlayer.tsx                             │
│  • Single <audio> player with activeAudioUrl dynamic switching         │
│  • Player actions: Retain Take #X as Baseline                          │
│  • Mounts AttemptComparison when baseline + current acoustics exist    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AttemptComparison.tsx                           │
│  • Evaluates checkCompatibility(baseline, current)                     │
│  • Executes computeAttemptComparison(baseline, current)                │
│  • Switches active playback track ('baseline' vs 'current')            │
│  • Promotes or clears baseline                                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          comparison.ts                                 │
│  • Pure, deterministic arithmetic functions                            │
│  • formatSignedDifference, formatSignedInteger                         │
│  • Zero-dependency calculation with strict unit attribution            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Structures & Types

```typescript
export interface StoredAttempt {
  takeNumber: number;
  exerciseId: string;
  exerciseTitle: string;
  audioBlob: Blob | null;
  audioUrl: string;
  mimeType: string | null;
  measurements: AcousticMeasurements | null;
  transcript: TranscriptData | null;
  createdAt: string;
}

export interface MetricComparisonItem {
  key: string;
  label: string;
  unit: string;
  differenceUnit?: string;
  baselineValue: number | null;
  currentValue: number | null;
  difference: number | null;
  formattedBaseline: string;
  formattedCurrent: string;
  formattedDifference: string;
  notes?: string;
}

export interface CompatibilityReport {
  isCompatible: boolean;
  sameExercise: boolean;
  sameDetectorThreshold: boolean;
  sameDetectorMinGap: boolean;
  sameRecognizerModel: boolean;
  warnings: string[]
}
```

---

## 4. Resource & Memory Lifecycle (Blob Object URLs)
When a take is designated as baseline:
1. `useAttemptComparison.setBaseline`:
   - Checks if a previous baseline URL exists; if so, calls `URL.revokeObjectURL(prevUrl)`.
   - Generates a dedicated Object URL from `audioBlob`: `URL.createObjectURL(blob)`.
   - Decouples the baseline audio from the recorder's internal URL, ensuring that when the recorder resets for Take 2 (`resetRecording()` -> `URL.revokeObjectURL(take1RecorderUrl)`), the baseline remains fully playable.
2. `useAttemptComparison.clearBaseline`:
   - Revokes the retained baseline Object URL.
   - Clears state to `null`.
3. Component Unmount:
   - An effect cleanup calls `URL.revokeObjectURL` on any active baseline URL, preventing memory leaks in single-page navigation.

---

## 5. Single-Player Auditioning Architecture
To prevent overlapping audio playback:
- A single `<audio ref={audioRef} src={activeAudioUrl} />` element exists in the DOM.
- `activeAudioTrack` toggles between `'current'` and `'baseline'`.
- When switching tracks:
  - `activeAudioUrl` updates to the target take's URL.
  - Player resets `currentTime = 0` and `isPlaying = false`.
  - Scrubber, timestamp labels, and play/pause controls immediately bind to the selected track.
