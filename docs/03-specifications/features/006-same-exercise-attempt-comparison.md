# Feature Specification: Same-Exercise Attempt Comparison (006)

## 1. Overview & Objective
The Same-Exercise Attempt Comparison feature enables learners to retain one analyzed spoken take as an objective comparison baseline within their active browser session. After recording and analyzing a subsequent attempt of the same exercise, the application presents a side-by-side comparative table of physical acoustic delivery measurements and transcript-derived pacing metrics, complete with signed numeric differences and units.

---

## 2. Scientific & Pedagogical Invariants
1. **Measurement vs. Value Judgment**:
   - Physical differences ($\Delta = \text{Current} - \text{Baseline}$) are reported as objective signed values with units (e.g. `+2.5 s`, `-2 gaps`, `+15.0 WPM`, `0.0 s`).
   - Faster speaking cadence, fewer non-speech pauses, or higher speech activity ratios are **never automatically labeled as "improvement" or "better"**.
   - In human communication and placement interviews, intentional pauses are vital for physiological recovery (inhalation), cognitive clause planning, and rhetorical emphasis; speaking too fast can impair listener comprehension.
2. **Absolute Prohibition of Fake Assessment Scores**:
   - The comparison engine does not generate speculative "fluency scores", letter grades, or percentage ratings.
3. **Acoustic & Linguistic Decoupling**:
   - Physical timing metrics (total duration, speech-active duration, speech activity ratio, internal pause count, and total pause time) are derived directly from audio DSP analysis and remain fully comparable even when transcripts are unavailable.
   - Pacing metrics (total WPM and articulation WPM) require speech recognition and are explicitly flagged as ASR-dependent. When a transcript is unavailable, WPM differences display `N/A (Transcript required)`.
4. **Configuration Compatibility Verification**:
   - The engine audits compatibility across:
     - Exercise identity (`exerciseId`).
     - Detector energy threshold (`energy_threshold_db`).
     - Minimum gap threshold (`min_gap_duration_seconds`).
     - ASR model identity (`model_name`).
   - Any divergence produces an explicit Configuration Divergence warning alerting the user that differences may stem from algorithm parameters rather than vocal delivery.
5. **Single Active Media Player Invariant**:
   - Both attempts are auditioned through a single active `<audio>` element with track switching, preventing overlapping audio streams or resource collisions.
6. **Session-Only Memory & Safe Resource Management**:
   - Comparison baselines are retained in browser session memory and released on page reload.
   - Dedicated `Blob` object URLs created for baseline playback are explicitly revoked via `URL.revokeObjectURL` upon baseline replacement, clearance, or component unmount.

---

## 3. Comparative Metrics Matrix

| Metric Key | Metric Name | Unit | Formula / Calculation | Description |
| :--- | :--- | :--- | :--- | :--- |
| `recordingDuration` | Recording Duration | `s` | $T_{\text{current}} - T_{\text{baseline}}$ | Total elapsed audio time from record to stop. |
| `speechActiveDuration` | Estimated Speech-Active Time | `s` | $T_{\text{speech, current}} - T_{\text{speech, baseline}}$ | Total accumulated voice phonation time. |
| `speechActivityPercentage` | Speech Activity Ratio | `%` (values) / `pp` ($\Delta$) | $\text{Ratio}_{\text{current}} - \text{Ratio}_{\text{baseline}}$ | Percentage of recording time containing active voice. Difference is expressed in percentage points (`pp`). |
| `internalGapCount` | Internal Pause Count ($\ge 250\text{ ms}$) | `gaps` | $N_{\text{gaps, current}} - N_{\text{gaps, baseline}}$ | Count of non-speech pauses between speech bursts. |
| `totalGapDuration` | Total Internal Pause Time | `s` | $T_{\text{gaps, current}} - T_{\text{gaps, baseline}}$ | Accumulated duration of detected internal pauses. |
| `meanGapDuration` | Mean Internal Pause Length | `s` | $\bar{T}_{\text{gaps, current}} - \bar{T}_{\text{gaps, baseline}}$ | Average duration per detected internal pause. |
| `wpmTotal` | Estimated Overall Pace | `WPM` | $\text{WPM}_{\text{current}} - \text{WPM}_{\text{baseline}}$ | Total words per minute (ASR transcript-dependent). |
| `wpmSpeechOnly` | Estimated Articulation Rate | `WPM` | $\text{WPM}_{\text{artic, current}} - \text{WPM}_{\text{artic, baseline}}$ | Words per active speech minute (ASR transcript-dependent). |

---

## 4. User Interaction & Workflow

```
[Record Take #1] ──> [Upload Take #1] ──> [Analyze Delivery]
                                                 │
                                                 ▼
                                     [Retain Take #1 as Baseline]
                                                 │
                     ┌───────────────────────────┴───────────────────────────┐
                     ▼                                                       ▼
            [Record Another Take]                               [Switch Exercise]
                     │                                                       │
         Take #1 Baseline Preserved                               Take #1 Baseline Preserved
                     │                                                       │
            [Record Take #2]                                        [Record Take #1 (New Ex)]
                     │                                                       │
            [Analyze Delivery]                                      [Analyze Delivery]
                     │                                                       │
                     ▼                                                       ▼
        Side-by-Side Comparison:                                Compatibility Warning:
          • Compatible status banner                              • Exercise mismatch warning
          • Side-by-side metric table                             • Metric table displayed
          • Signed deltas with units                              • User can Update or Clear
          • Single-player track switcher
```

---

## 5. API & Interface Contract

### 5.1 Pure Calculation Interface (`utils/comparison.ts`)
```typescript
export function computeAttemptComparison(
  baseline: StoredAttempt,
  current: StoredAttempt
): AttemptComparisonResult | null;

export function checkCompatibility(
  baseline: StoredAttempt,
  current: StoredAttempt
): CompatibilityReport;
```

### 5.2 Hook Lifecycle (`hooks/useAttemptComparison.ts`)
```typescript
export function useAttemptComparison(): {
  baselineAttempt: StoredAttempt | null;
  setBaseline: (payload: SetBaselinePayload) => void;
  clearBaseline: () => void;
};
```
