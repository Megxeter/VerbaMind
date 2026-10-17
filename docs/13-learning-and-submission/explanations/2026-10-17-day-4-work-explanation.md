# VERBAMIND — Day 4 Engineering Deep Dive & Viva Defense Guide
**Milestone 3 Increment**: Same-Exercise Attempt Comparison & Baseline Auditioning  
**Author**: Engineering Team  
**Date**: 17 October 2026  
**Status**: Implemented, Verified & Documented

---

## 1. Executive Summary & Objective

On Day 4, VERBAMIND advanced from single-take acoustic analysis to **same-exercise attempt comparison within the browser session**. 

### The Problem
When engineering students practice for campus placements or technical interviews, practicing once is insufficient. Candidates need to retry answers, adjust their delivery, and observe the physical consequences of their adjustments (e.g., did they pause more naturally, did their articulation rate change, or did their overall speech active time increase?). 

Prior to Day 4, each retake wiped the previous recording's delivery measurements from view. Candidates had no way to compare their previous take against their current attempt without manually jotting down numbers on paper.

### The Solution
We implemented a client-side attempt retention and side-by-side comparison engine:
1. **Baseline Retention**: A candidate can lock any analyzed take as a comparison baseline with a single click.
2. **Side-by-Side Physical Delivery Metrics**: When a subsequent take of the same exercise is analyzed, an automated comparison table shows the baseline metrics, current metrics, and signed numeric differences with explicit physical units.
3. **Single Active Audio Player Invariant**: Candidates can alternate playback between the baseline take and the current take using a unified audio player, ensuring zero audio overlap.
4. **Epistemic & Academic Integrity**: Physical measurements (e.g. speaking rate, pause frequency) are strictly separated from qualitative value judgments. Faster speech or fewer pauses are never automatically labeled as "improvement", and speculative composite fluency scores are prohibited.
5. **Percentage Point (`pp`) Metric Rigor**: Differences between speech activity percentages are strictly formatted in percentage points (`pp`) rather than percent (`%`), preventing mathematical conflation between additive percentage differences and relative rate changes.

---

## 2. System Architecture & Seam Boundaries

The attempt comparison capability was built cleanly without modifying core backend APIs or introducing remote cloud dependencies.

```
┌────────────────────────────────────────────────────────────────────────┐
│                               App.tsx                                  │
│  • Manages selected exercise, take counter, and session ID             │
│  • Holds useAttemptComparison() hook state                             │
│  • Renders persistent "Active Baseline: Take #X" banner in studio       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         Props: baselineAttempt,
                         onSetBaseline, onClearBaseline
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            AudioPlayer.tsx                             │
│  • Controls single <audio> DOM element with dynamic source switching   │
│  • Action: "Retain Take #X as Baseline"                                │
│  • Conditionally renders AttemptComparison when baseline is active     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AttemptComparison.tsx                           │
│  • Evaluates checkCompatibility(baseline, current)                     │
│  • Invokes pure function computeAttemptComparison(baseline, current)   │
│  • Provides single-player track toggle ('baseline' vs 'current')       │
│  • Promotes current take to baseline or clears baseline                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             comparison.ts                              │
│  • Pure, deterministic mathematical difference engine                  │
│  • Signed delta formatting with units (+2.5 s, -2 gaps, +5.0 pp)       │
│  • Configuration divergence auditor (exercise, detector, model)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. How Each Feature Works

### 3.1 Attempt Retention & Object URL Lifecycle
In browser audio recording, resetting the MediaRecorder to capture a new take typically invalidates or revokes the previous recording's object URL. To allow listening to the baseline while capturing and auditioning new takes:
- When the user clicks **"Retain Take #X as Baseline"**, the `useAttemptComparison` hook generates a dedicated Blob Object URL (`URL.createObjectURL(blob)`).
- This baseline URL is completely decoupled from the audio recorder's internal buffer lifecycle.
- When the baseline is updated, cleared, or when the user navigates away, `URL.revokeObjectURL` is explicitly called to prevent memory leaks in long-running browser sessions.

### 3.2 Single-Player Audio Invariant
A critical design requirement is preventing overlapping audio playback. Spawning two `<audio>` tags would allow candidates to accidentally play both recordings simultaneously, causing cognitive confusion.
- Instead, the DOM contains **exactly one** `<audio>` element (`<audio ref={audioRef} src={activeAudioUrl} />`).
- The player maintains an `activeAudioTrack` state (`'current'` vs `'baseline'`).
- Clicking **"Listen to Take #1 (Baseline)"** swaps the audio element's `src` to the baseline URL, resets the playback position, and updates player labels.
- Clicking **"Listen to Take #2 (Current)"** restores the current take's audio stream.

### 3.3 Compatibility Auditing
Comparing measurements across different exercises or conflicting detector configurations is scientifically invalid. Before displaying metrics, the engine runs `checkCompatibility`:
1. **Exercise Matching**: Both takes must share the same `exerciseId`.
2. **Acoustic Detector Sensitivity**: Energy threshold (default: `-40.0 dBFS`) and minimum pause filter (default: `0.25 s`) must match.
3. **Recognizer Model**: The speech recognition model (e.g. `base.en`) must match.

If any parameter differs, the UI displays a high-contrast **Configuration Divergence Warning** banner explaining why the values cannot be directly equated.

### 3.4 Handling Missing Transcripts Gracefully
Candidates frequently analyze physical acoustic delivery before running transcription. 
- If Take 2 has acoustic measurements but no transcript, physical metrics (duration, speech active time, pause counts, pause durations) compare cleanly.
- Transcript-dependent metrics (Overall Pace WPM and Articulation Rate WPM) display `N/A (Transcript required)`.
- When the candidate subsequently transcribes Take 2 and re-runs delivery analysis, the WPM differences populate automatically.

---

## 4. Metric Comparison Calculations & Examples

The comparison engine computes signed numeric differences ($\Delta = \text{Current} - \text{Baseline}$):

| Delivery Metric | Baseline (Take 1) | Current (Take 2) | Difference ($\Delta$) | Unit & Mathematical Definition |
| :--- | :--- | :--- | :--- | :--- |
| **Recording Duration** | `40.0 s` | `45.0 s` | `+5.0 s` | Elapsed audio time from start to stop |
| **Speech-Active Time** | `30.0 s` | `36.0 s` | `+6.0 s` | Accumulated time with detected voice energy |
| **Speech Activity Ratio** | `75.0 %` | `80.0 %` | `+5.0 pp` | **Percentage points (`pp`)**: $80.0\% - 75.0\% = +5.0\text{ pp}$ |
| **Internal Pause Count** | `5 gaps` | `3 gaps` | `-2 gaps` | Non-speech pauses $\ge 250\text{ ms}$ |
| **Total Pause Duration** | `4.0 s` | `2.4 s` | `-1.6 s` | Total elapsed silence between speech phrases |
| **Mean Pause Duration** | `0.8 s` | `0.8 s` | `0.0 s` | Average duration per internal gap |
| **Overall Pace** | `120.0 WPM` | `135.0 WPM` | `+15.0 WPM` | Total words divided by total elapsed minutes |
| **Articulation Rate** | `160.0 WPM` | `168.0 WPM` | `+8.0 WPM` | Total words divided by active voice minutes |

### Why "Percentage Points (`pp`)" Rather Than "%"?
If Take 1 has a speech activity ratio of $75\%$ and Take 2 has $80\%$, the arithmetic difference is:
$$\Delta = 80\% - 75\% = +5\text{ percentage points (pp)}$$
Labeling this as `+5%` is mathematically false: a 5% increase over $75\%$ would equal $75 \times 1.05 = 78.75\%$. Using `pp` preserves mathematical rigor.

---

## 5. Changed Files & Engineering Responsibilities

| File Path | Component Tier | Architectural Responsibility |
| :--- | :--- | :--- |
| `frontend/src/types/comparison.ts` | TypeScript Interfaces | Strongly typed interfaces for `StoredAttempt`, `MetricComparisonItem`, `CompatibilityReport`, and `AttemptComparisonResult`. |
| `frontend/src/utils/comparison.ts` | Pure Logic Utility | Deterministic arithmetic engine computing signed differences, handling missing values, auditing compatibility, and applying `pp` units. |
| `frontend/src/utils/comparison.test.ts` | Vitest Unit Tests | 8 comprehensive tests verifying arithmetic bounds, sign formatting, missing transcript handling, and zero score fabrication. |
| `frontend/src/hooks/useAttemptComparison.ts` | React Custom Hook | Stateful lifecycle manager for baseline attempt; handles dedicated Blob URL creation and revocation. |
| `frontend/src/hooks/useAttemptComparison.test.ts` | Vitest Hook Tests | 5 tests verifying baseline persistence across recorder resets, URL revocation on replacement, and unmount cleanup. |
| `frontend/src/components/AttemptComparison.tsx` | UI Component | Responsive side-by-side comparison table, track switcher buttons, compatibility banners, and pedagogical integrity notices. |
| `frontend/src/components/AttemptComparison.test.tsx` | Vitest Component Tests | 5 tests verifying table rendering, accessibility labels, track toggle callbacks, and compatibility warning rendering. |
| `frontend/src/components/AudioPlayer.tsx` | UI Component | Single `<audio>` element with dynamic track switching, "Retain Take #X as Baseline" action, and player mode indicator. |
| `frontend/src/components/AudioPlayer.test.tsx` | Vitest Integration Tests | 12 tests verifying single `<audio>` tag DOM invariant, source switching, and full delivery analysis workflows. |
| `frontend/src/App.tsx` | Application Root | Lifts `useAttemptComparison` state to top level; displays persistent baseline banner in recording studio. |
| `frontend/src/index.css` | Styling System | Custom high-contrast styles for comparison tables, signed delta badges, warning callouts, and track switcher buttons. |

---

## 6. Verification & Test Evidence Summary

### Automated Test Suite: 152 / 152 Passing (0 Failures)
- **Backend Tests (`pytest`)**: **81 passed / 81 total** in 5.23s.
- **Frontend Tests (`vitest`)**: **71 passed / 71 total** across 12 test files in 17.68s (+20 new tests added on Day 4).
- **Frontend Typecheck & Production Build**: `tsc -b && vite build` passed cleanly in 1.11s (31 modules transformed, 0 errors).

### User-Confirmed Manual Verifications (17 October 2026)
1. **Side-by-side display**: Confirmed that the comparison panel displays both baseline and current recordings side by side with their respective take identifiers and metrics.
2. **Single-player playback switching**: Confirmed that clicking between "Listen to Take #1 (Baseline)" and "Listen to Take #2 (Current)" plays the selected take without audio overlap or secondary audio player instances.
3. **WPM recalculation on re-analysis**: Confirmed that transcribing the current take and re-running delivery analysis correctly populates WPM in both the current column and the signed difference column.
4. **Screenshot evidence**: User screenshots confirm visual rendering of gap measurements and numeric differences in the live browser interface.

---

## 7. ASR Benchmark Verification Checkpoint

The three-recording development evaluation comparing offline Whisper `base.en` vs `small.en` reached the following checkpoint:

| Recording | Audio Duration | Reference Transcript Status | Details / Actions Received |
| :--- | :--- | :--- | :--- |
| **Clip 1** | `7.98 s` | **Verified & Saved** | Verified against `ref_clip1.txt`. |
| **Clip 2** | `47.16 s` | **Verified & Saved** | Manually verified across all 5 differing word locations through interactive audio auditioning and saved to `ref_clip2.txt`. |
| **Clip 3** | `45.66 s` | **Partially Verified (3/4)** | Differences 1, 2, and 3 confirmed by user (`"final year computer science"`, `"algorithms"`, `"communication"`). Difference 4 (`"I am eager to"` vs `"and eager to"`) is pending user confirmation. |

**Invariants Maintained**:
- Default recognizer remains `base.en`.
- No transcripts were fabricated or substituted with exercise catalog text.
- Reference transcripts remain separate from inference prompts.
- All evaluation audio and reference texts remain strictly private and Git-ignored.

---

## 8. Limitations & Tomorrow's Starting Point

### Current System Limitations
1. **Session-Only Memory**: Retained baselines exist only in active browser memory and reset completely on page reload. Database persistence and candidate user profiles remain future work.
2. **Acoustic Detector Calibration**: The -40.0 dBFS energy threshold and 250ms minimum gap filter are deterministic and calibrated for clean speech; performance under high ambient noise or reverberation has not been benchmarked.
3. **Pending ASR Benchmark**: Clip 3 Difference 4 requires confirmation before the aggregate Word Error Rate (WER) comparison script runs.

### Tomorrow's Starting Point (Day 5)
1. **Conclude ASR Benchmark**: Confirm Difference 4 for Clip 3, execute `compare_models.py`, and record aggregate WER results across all three clips.
2. **Pronunciation & Phonemic Alignment Foundation**: Begin investigating acoustic phoneme alignment techniques to prepare for evidence-linked pronunciation feedback without conflating reading errors with articulation.

---

## 9. Viva Voce Defense Questions & Answers

### Q1: Why did you build attempt comparison inside the browser session instead of creating a backend database table?
**Answer**: In agile engineering and following the Ponytail principle (*the simplest robust architecture that fulfills current requirements*), candidate comparison within a single practice session does not require database schemas, user authentication, or persistent storage migrations. By keeping comparison state in the React client, we delivered instantaneous side-by-side feedback with zero backend network overhead, zero security exposure of audio recordings, and zero persistent storage accumulation.

### Q2: Why is it scientifically improper to label a faster speaking rate or fewer pauses as an "improvement"?
**Answer**: Human speech communication is rhetorical, syntactic, and contextual. In job interviews, speaking too fast (>160 WPM) or eliminating pauses entirely indicates nervousness and significantly degrades listener comprehension. Pauses are essential for cognitive processing, respiration, and emphasizing key arguments. VERBAMIND measures physical delivery; it is the user's responsibility (guided by exercise target WPM guidelines) to judge whether an increase or decrease aligns with their goals.

### Q3: Why is speech activity ratio difference expressed in percentage points (`pp`) rather than percent (`%`)?
**Answer**: When subtracting two percentages (e.g. $80\% - 75\% = 5$), the value $5$ represents an absolute difference on a percentage scale, which is termed *percentage points* (`pp`). Expressing it as `+5%` would mathematically imply a relative growth of $5\%$ of $75\%$ (which is $+3.75\%$). Using `pp` maintains strict mathematical and scientific accuracy.

### Q4: How does the system prevent two audio tracks from playing simultaneously when comparing attempts?
**Answer**: We enforced a strict DOM architectural invariant: the interface renders exactly one `<audio>` element. When the user clicks between "Listen to Baseline" and "Listen to Current Take", the component dynamically switches the `src` attribute of the single existing audio element. This guarantees that multiple audio playback streams cannot exist simultaneously.

### Q5: How do you prevent memory leaks when retaining audio Blobs across retakes?
**Answer**: Creating Object URLs with `URL.createObjectURL(blob)` allocates internal browser memory tables that persist until the document unloads unless explicitly released. In `useAttemptComparison`, we maintain a reference to the active baseline URL and explicitly call `URL.revokeObjectURL(url)` whenever the baseline is replaced, cleared, or when the React component unmounts.
