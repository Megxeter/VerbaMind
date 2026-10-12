# Fluency vs. Pronunciation vs. Reading Accuracy vs. Relevance

In computer-assisted language learning (CALL) and automated speaking assessment, conflating distinct acoustic and linguistic dimensions is a common failure mode. In VERBAMIND, these four dimensions are strictly separated:

---

## 1. Fluency (Temporal & Acoustic Rhythm)
- **Definition**: The continuous, rhythmic flow of spoken delivery without undue hesitation, stumbling, or unnatural disruption.
- **Physical Correlates**:
  - **Speech Rate**: Total words spoken per total elapsed time (including pauses).
  - **Articulation Rate**: Total words/syllables spoken per total phonation time (excluding pauses).
  - **Mean Length of Run (MLR)**: Average number of words spoken between pauses.
  - **Pause Distribution**: Count and duration of silent intervals $> 250\text{ ms}$.
  - **Filled Pauses**: Frequency of vocalized hesitation tokens (`um`, `uh`, `er`).
- **Key Insight**: A speaker with an accent or non-native phonemes can still possess high fluency if their rhythm, pausing, and flow are smooth and effortless.

---

## 2. Reading Accuracy (Linguistic Fidelity)
- **Definition**: How faithfully the spoken utterance matches a predetermined reference text.
- **Primary Metric**: **Word Error Rate (WER)** via Levenshtein alignment:
  $$\text{WER} = \frac{S + D + I}{N}$$
  where $S$ is substitutions, $D$ is deletions (skipped words), $I$ is insertions (added words), and $N$ is reference word count.
- **Scope**: Applied exclusively to Read-Aloud exercises where a canonical ground truth text exists. Not applicable to spontaneous topic speaking or interview answers.
- **Critical Distinction: Reading Accuracy Does NOT Establish Pronunciation**:
  - Reading accuracy verifies **lexical selection** (whether the candidate vocalized the target word sequence without omitting, inserting, or substituting words).
  - A candidate can achieve **100% Reading Accuracy ($\text{WER} = 0$)** by correctly reading every word on the page, while simultaneously pronouncing multiple phonemes incorrectly (e.g. pronouncing silent letters, vowel shifts, voicing errors, or misplacing lexical stress).
  - Conversely, an automatic speech recognition (ASR) decoder might successfully transcribe an intended word despite severe phonetic degradation, or mis-transcribe an intelligible word due to acoustic model language bias.
  - Therefore, reading accuracy and pronunciation must be measured via decoupled, independent models.

---

## 3. Pronunciation (Phonetic Intelligibility)
- **Definition**: The phonetic precision with which individual phonemes, consonant clusters, and syllable stresses are articulated.
- **Evaluation Mechanism**: Goodness of Pronunciation (GoP) scores derived from acoustic models:
  $$\text{GoP}(p) = \frac{1}{|t_e - t_s|} \log \frac{P(O_{t_s:t_e} | p)}{\sum_q P(O_{t_s:t_e} | q)}$$
- **Distinction from Accent**: Accent refers to regional phonological patterns; pronunciation refers to intelligible enunciation that does not impede comprehension.
- **Independence from Reading Accuracy**: Evaluated on phoneme posterior log-likelihoods rather than word token string equality.

---

## 4. Answer Relevance (Semantic Completeness)
- **Definition**: Whether the candidate's speech addressed the prompt or placement interview question.
- **Evaluation Mechanism**: Sentence-transformer semantic cosine similarity and LLM structured rubric evaluation against expected talking points.
- **Key Invariant**: Evaluated entirely independently of speech rate or vocal pauses. A candidate who speaks with hesitations may still provide a deeply relevant answer, and vice versa.
