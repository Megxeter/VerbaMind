# Test Evidence: Day 4 — Same-Exercise Attempt Comparison

## 1. Execution Summary
- **Execution Date**: 2026-10-17 (Day 4)
- **Environment**: Python 3.12.6, Windows 11 AMD64, Node v23.3.0, Pytest 9.1.1, Vitest 3.2.7.
- **Backend Test Status**: 81 passed / 81 total (100% pass rate in 4.86s).
- **Frontend Test Status**: 71 passed / 71 total across 12 test files (100% pass rate in 21.74s).
- **TypeScript & Bundler**: `tsc -b && vite build` clean in 1.02s (0 errors, 31 modules transformed).
- **Total Automated Test Count**: **152 passed / 152 total** (0 failures, 0 regressions).

---

## 2. Attempt Comparison Calculation Tests (`src/utils/comparison.test.ts`)
Tested pure arithmetic functions, signed difference formatting, missing value handling, and scientific invariants in `frontend/src/utils/comparison.ts`:

| Test Name | Boundary Condition | Verified Behavior |
| :--- | :--- | :--- |
| `computes exact side-by-side metric differences with units when both attempts are complete` | Complete acoustic measurements and transcripts for both takes | Accurately calculates signed deltas ($\Delta = \text{Current} - \text{Baseline}$): duration (`+2.5 s`), speech-active time (`+4.0 s`), speech activity ratio (`+5.0 pp`), gap count (`-2 gaps`), total gap time (`-1.6 s`), mean gap time (`0.0 s`), total WPM (`+15.0 WPM`), and articulation WPM (`+8.0 WPM`). |
| `handles unavailable transcript on current take gracefully without breaking acoustic comparison` | Current take has acoustic data but no transcript | Acoustic metrics compare cleanly; WPM items report `difference: null` and `formattedDifference: "N/A (Transcript required)"`. |
| `handles missing measurements gracefully by returning null` | Either attempt has `measurements: null` | Returns `null` without throwing exceptions. |
| `preserves scientific integrity: does NOT invent scores or label faster/fewer gaps as improvement` | Result object key inspection | Strictly verifies absence of `score`, `grade`, `fluencyScore`, or `improvementScore`. Verified that diff text does not contain subjective words like "improved", "better", or "worse". |
| `flags perfect compatibility when exercises and settings match` | Identical exercise ID, threshold (-40 dBFS), min gap (0.25s), model (`base.en`) | Returns `isCompatible: true` and 0 warnings. |
| `flags exercise mismatch when attempts are recorded for different passages` | Different `exerciseId` (`tech-caching` vs `self-intro`) | Returns `sameExercise: false`, `isCompatible: false`, and descriptive warning. |
| `flags detector threshold mismatch when acoustic parameters differ` | Energy thresholds differ (-40.0 dBFS vs -35.0 dBFS) | Returns `sameDetectorThreshold: false` and warns about algorithm divergence. |
| `flags recognizer model divergence when transcript models differ` | ASR models differ (`base.en` vs `small.en`) | Returns `sameRecognizerModel: false` and warns about ASR accuracy divergence. |

---

## 3. Attempt Comparison Hook Tests (`src/hooks/useAttemptComparison.test.ts`)
Tested state lifecycle, dedicated Blob URL creation, and safe memory revocation in `frontend/src/hooks/useAttemptComparison.ts`:

| Test Name | Scenario | Verified Result |
| :--- | :--- | :--- |
| `starts with baselineAttempt as null` | Initial hook mount | State is `null`. |
| `sets baseline attempt, creating a dedicated object URL from the blob` | Passing audio Blob to `setBaseline` | Generates dedicated object URL via `URL.createObjectURL(blob)`, isolating it from recorder resets. |
| `clears baseline attempt and revokes its retained object URL safely` | Calling `clearBaseline()` | Calls `URL.revokeObjectURL(url)` and sets state to `null`. |
| `replaces baseline attempt by revoking previous object URL and creating a new one` | Setting new baseline while old baseline is active | Revokes previous baseline URL (`url1`) and allocates fresh URL (`url2`). |
| `cleans up and revokes retained object URL on unmount` | Hook unmount | Revokes retained baseline URL to prevent memory leaks in client session. |

---

## 4. Attempt Comparison Component Tests (`src/components/AttemptComparison.test.tsx`)
Tested UI rendering, accessibility, and track switching in `frontend/src/components/AttemptComparison.tsx`:

| Test Name | Scenario | Verified Result |
| :--- | :--- | :--- |
| `renders side-by-side comparison table with metric differences and units` | Baseline (Take 1) vs Current (Take 2) | Renders all 8 metric rows with baseline values, current values, signed differences (`+5.0 pp` for speech activity), and units. Displays Measurement vs. Assessment notice and session-only memory disclaimer. |
| `switches active playback track using single audio player controls` | Clicking "Listen to Take #1 (Baseline)" | Triggers `onSelectAudioTrack('baseline')`. |
| `triggers onReplaceBaseline and onClearBaseline callbacks when buttons are clicked` | Clicking action buttons | Successfully invokes callbacks. |
| `displays compatibility warning when exercises differ` | Baseline and current exercise IDs differ | Renders high-contrast warning banner explaining text length divergence. |
| `displays N/A when transcript is missing for current take without breaking` | Current take without transcript | Renders `N/A (Transcript required)` chips without rendering crashes. |

---

## 5. Audio Player Integration Tests (`src/components/AudioPlayer.test.tsx`)
Tested player integration, single-player invariant, and baseline retention:

| Test Name | Scenario | Verified Result |
| :--- | :--- | :--- |
| `handles retaining take as comparison baseline after acoustic analysis` | Complete upload and delivery analysis for Take 1 | Renders "Retain Take #1 as Baseline" button; clicking calls `onSetBaseline` with complete attempt payload. |
| `displays side-by-side comparison and switches active audio track in single player` | Baseline provided, Take 2 recorded and analyzed | Displays comparison table; verifies exactly ONE `<audio>` element exists in the DOM; clicking listen buttons switches `.src` dynamically between `blob:...fakeUrl` and `blob:...mock-baseline-audio` without duplicate instances. |

---

## 6. Status Classification: Confirmed vs. Pending Checks

### Confirmed Checks (Automated Evidence-Backed)
1. **Automated Unit & Integration Tests**: 152 automated tests passing cleanly (81 backend pytest, 71 frontend vitest across 12 suites).
2. **TypeScript & Bundler Hygiene**: Zero type errors; clean production build in 1.02s.
3. **Single Active Player Invariant**: DOM assertions verify that only one `<audio>` element is created and reused across baseline and current takes.
4. **Blob URL Lifecycle & Revocation**: Verified that retained object URLs are safely revoked upon clearing, replacement, and unmount.
5. **Scientific Invariant Enforcement**: Asserts that metrics are purely physical signed numbers with units (`pp` for percentage differences), without subjective scoring or equating faster pace to "improvement".
6. **Configuration Divergence Auditing**: Tested detection of exercise, detector threshold, and recognizer model discrepancies.

### User-Confirmed Checks (Live Manual Browser Validation — 2026-10-17)
1. **Side-by-Side Attempt Comparison Rendering**: Confirmed that the comparison panel displays both baseline and current recordings side by side with their respective take identifiers and metrics.
2. **Single-Player Playback Switching**: Confirmed that clicking between "Listen to Take #1 (Baseline)" and "Listen to Take #2 (Current)" plays the selected take without audio overlap or secondary audio player instances.
3. **WPM Recalculation Flow**: Confirmed that when the current attempt is transcribed and re-analyzed for delivery acoustics, WPM correctly populates and displays in both the current take column and the signed difference column.
4. **Screenshot Evidence**: User screenshots confirm visual rendering of gap measurements and numeric differences in the live browser interface.

### Pending / Untested Checks (Explicitly Not Passed)
1. **Detector & Acoustic Model Accuracy**: Physical acoustic detector accuracy (-40.0 dBFS threshold, 250ms gap duration) on noisy or multi-speaker audio remains unverified; not marked as passed.
2. **ASR Multi-Recording Benchmark (WER)**:
   - Clip 1 reference verified & saved (`backend/storage/evaluations/ref_clip1.txt`).
   - Clip 2 reference verified through interactive auditory check across all 5 differing word locations and saved (`backend/storage/evaluations/ref_clip2.txt`).
   - Clip 3 reference partially verified: Differences 1, 2, and 3 confirmed by user (`"final year computer science"`, `"algorithms"`, `"communication"`). Difference 4 (`"I am eager to"` vs `"and eager to"`) is pending user confirmation.
   - 3-clip benchmark execution (`compare_models.py`) strictly retained as pending; `base.en` retained as default recognizer.
3. **Cross-Session Persistence**: Candidate accounts and database persistence remain planned for future milestones.
