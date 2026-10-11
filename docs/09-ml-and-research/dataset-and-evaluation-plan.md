# Dataset Collection & Speaker-Separated Evaluation Plan

## 1. Objective
Establish a scientifically rigorous dataset curation and evaluation methodology for training VERBAMIND's custom speech fluency scoring model. A core academic invariant is that **fluency assessment must be evaluated strictly on unseen speakers**.

---

## 2. Dataset Sourcing & Composition

| Dataset / Source | Description | Size / Utterances | Licensing / Access | Role in VERBAMIND |
| :--- | :--- | :--- | :--- | :--- |
| **Speechocean762** | Open-source speech corpus with expert multi-dimensional annotations (Fluency, Pronunciation, Completeness, Prosody) across non-native English speakers. | 5,000 utterances (250 speakers) | CC BY 4.0 | Primary training & benchmarking ground truth for fluency scoring. |
| **LibriSpeech Clean (subset)** | Standard read-speech audio corpus for baseline acoustic modeling and feature distribution calibration. | ~100 hours clean read speech | CC BY 4.0 | Baseline calibration for reference acoustic norms (WPM, pause density). |
| **In-House Campus Cohort (Planned)** | Optional consented candidate recordings on campus placement read-aloud passages. | Target: 30–50 students (~150 takes) | IRB / Consent-gated private storage | Out-of-domain cross-speaker evaluation test set. |

---

## 3. Acoustic Feature Engineering Matrix
To ensure our custom model learns true delivery acoustics rather than memorizing speaker vocal timbre, we extract physically grounded acoustic and temporal features:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      ACOUSTIC FEATURE EXTRACTOR                        │
├──────────────────────────┬─────────────────────────────────────────────┤
│ Feature Category         │ Physical Correlates                         │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 1. Temporal Dynamics     │ • Speech Rate (words/total seconds)         │
│                          │ • Articulation Rate (words/phonation secs)  │
│                          │ • Mean Length of Run (words between pauses) │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 2. Pause Distribution    │ • Silent Pause Count (>250ms)               │
│                          │ • Total Silent Pause Duration Ratio         │
│                          │ • Filled Pause Frequency (um, uh tokens)    │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 3. Pitch & Prosody       │ • Fundamental frequency ($F_0$) mean & std  │
│                          │ • Pitch dynamic range (semitone spread)     │
│                          │ • Voiced-to-Unvoiced ratio                  │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 4. Spectral Dynamics     │ • MFCC mean & variance (13 coefficients)    │
│                          │ • Spectral centroid & spectral roll-off     │
│                          │ • Energy envelope RMS variability           │
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

## 4. Speaker-Separated Evaluation Methodology (Crucial Academic Invariant)

### The Threat of Speaker Leakage in Speech ML
In naive speech machine learning projects, researchers often shuffle audio samples randomly into 80/20 train/test splits. **This is fundamentally invalid in speech research** because utterances from the same person end up in both the training set and the test set. The model ends up memorizing speaker-specific vocal tract characteristics (pitch range, accent, mic quality) rather than evaluating general fluency. When evaluated on a new user, accuracy collapses.

### Our Solution: GroupKFold by Speaker ID
VERBAMIND enforces strict **Speaker-Separated GroupKFold Cross-Validation**:

$$\text{Speakers}_{\text{train}} \cap \text{Speakers}_{\text{test}} = \emptyset$$

```
All Speakers: [S01, S02, S03, S04, S05, S06, ..., S250]
Fold 1: Train on {S01..S200} ──> Evaluate on {S201..S250} (Unseen Speakers)
Fold 2: Train on {S01..S150, S201..S250} ──> Evaluate on {S151..S200} (Unseen Speakers)
...
```

### Evaluation Metrics
We evaluate model predictions strictly using standard academic scoring criteria:
1. **Pearson Correlation Coefficient ($r$)**: Measures linear agreement between predicted fluency and expert human scores. Target: $r \ge 0.75$.
2. **Spearman Rank Correlation ($\rho$)**: Measures ranking fidelity (does the model rank candidates in the correct relative fluency order?). Target: $\rho \ge 0.72$.
3. **Mean Absolute Error (MAE)**: Measures average point divergence on a standard 1–5 or 0–100 scale. Target: $\text{MAE} \le 0.45$ (on 5-point scale).

---

## 5. Labelling & Annotation Protocol
When collecting any internal student samples:
1. **Participant Consent**: Every participant signs an explicit digital consent agreement before recording.
2. **Anonymization**: Audio filenames are randomized UUIDs; no student names, roll numbers, or personal identifying information are stored with the audio.
3. **Decoupled Scoring Rubric**: Human annotators score three separate orthogonal dimensions on a 1–5 Likert scale:
   - **Dimension A: Fluency** (Cadence, pausing, continuity).
   - **Dimension B: Pronunciation** (Phoneme accuracy, clarity).
   - **Dimension C: Text Accuracy** (Word verbatim accuracy).
   Annotators are strictly instructed *never* to lower a fluency score because of an accent or minor word substitution.
