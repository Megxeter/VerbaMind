# Research Note: Acoustic Speech Activity, Pause Segmentation & Speaking Rate

## 1. Context & Motivation
A foundational goal in automated speech and communication coaching is quantifying delivery rhythm without confusing acoustic properties with linguistic proficiency or semantic competence.

In traditional human speech evaluation, speaking rate and pause patterns are fundamental components of fluency. However, naively thresholding audio or treating every pause as a hesitation creates erroneous, biased feedback. This note establishes the scientific foundations behind VerbaMind's Day 3 acoustic analysis engine.

---

## 2. Pause Physiology & Phonetic Foundations

### 2.1 The Goldman-Eisler 250 ms Threshold
In seminal psycholinguistic research, Goldman-Eisler (1968) demonstrated that silent intervals in natural speech divide into two distinct phenomena:
1. **Articulatory / Phonetic Closures (< 250 ms)**:
   - Brief silent intervals naturally produced by the vocal tract during stop consonant closures (/p/, /b/, /t/, /d/, /k/, /g/).
   - Average duration: 30 ms to 120 ms.
   - These are physical features of word pronunciation, **not communicative pauses**.
2. **Communicative & Cognitive Pauses ($\ge 250\text{ ms}$)**:
   - Breath groups (respiratory replenishment).
   - Syntactic boundary markers (commas, clause endings, sentence boundaries).
   - Cognitive planning / lexical retrieval pauses.

**Architectural Decision**: VerbaMind sets `min_gap_duration_seconds = 0.25` (250 ms) for internal non-speech gaps. Any silence below 250 ms is bridged through the 150 ms hangover window or excluded, ensuring students are never penalized for the vocal tract mechanics of pronouncing stop consonants.

### 2.2 Pauses as Measurements, NOT Mistakes
A critical invariant of VerbaMind is:
> *A pause is an acoustic measurement, not an inherent error.*

In professional and placement presentations:
- Fluent, deliberate speakers intentionally pause at key transition points for rhetorical impact and clarity.
- Rushing without pauses (100% speech activity ratio) often indicates nervousness and degrades listener comprehension.
- Consequently, detected gaps are recorded as timestamped physical intervals `[start_sec, end_sec, duration_sec]`, allowing later pedagogy modules to evaluate context, rather than blindly labeling all pauses as mistakes.

---

## 3. Peripheral Silence Separation
In typical user recordings:
1. The user presses "Record", pauses 0.3–1.0s before speaking (microphone latency, user preparation).
2. The user completes their sentence, pauses 0.5–1.5s before clicking "Stop".

Conflating this peripheral silence with internal pauses would heavily distort both speech activity ratios and pause frequency metrics. The acoustic engine strictly separates:
- **Leading Silence**: Interval from $t = 0.0$ to the start of the first detected speech segment.
- **Trailing Silence**: Interval from the end of the last detected speech segment to $t = \text{total\_duration}$.
- **Internal Non-Speech Gaps**: Silence intervals occurring strictly between the first and last speech boundaries.

---

## 4. Speaking Rate: Total WPM vs. Articulation Rate
In speech science (De Jong & Wempe, 2009; Boersma, 2001), speaking rate is analyzed via two distinct metrics:

1. **Overall Speaking Rate (Total WPM)**:
   $$\text{WPM}_{\text{total}} = \frac{\text{Word Count}}{\text{Total Duration (min)}}$$
   Reflects the overall conversational tempo including all pauses and breaths. Normal conversational range: **120 – 160 WPM**.

2. **Articulation Rate (Speech-Only WPM)**:
   $$\text{WPM}_{\text{speech}} = \frac{\text{Word Count}}{\text{Active Speech Duration (min)}}$$
   Reflects how fast the student speaks when actively articulating sounds, discounting pauses. Normal range: **140 – 190 WPM**.

If $\text{WPM}_{\text{speech}}$ is high but $\text{WPM}_{\text{total}}$ is low, it indicates the speaker speaks rapidly in bursts but takes long pauses to formulate thoughts. Both metrics are explicitly labeled as `rate_is_transcript_dependent = True` because they rely on speech recognition token counts.

---

## 5. References
- Goldman-Eisler, F. (1968). *Psycholinguistics: Experiments in Spontaneous Speech*. Academic Press, London.
- De Jong, N. H., & Wempe, T. (2009). *Praat script to detect syllable nuclei and measure speech rate automatically*. Behavior Research Methods, 41(2), 385–390.
- Boersma, P. (2001). *Praat, a system for doing phonetics by computer*. Glot International, 5(9/10), 341–345.
