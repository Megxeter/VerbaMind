import type {
  AttemptComparisonResult,
  CompatibilityReport,
  MetricComparisonItem,
  StoredAttempt,
} from '../types/comparison'

function formatSignedDifference(diff: number, unit: string, decimals = 1): string {
  const rounded = Number(diff.toFixed(decimals))
  if (rounded > 0) {
    return `+${rounded.toFixed(decimals)} ${unit}`
  }
  if (rounded < 0) {
    return `${rounded.toFixed(decimals)} ${unit}`
  }
  return `0.0 ${unit}`
}

function formatSignedInteger(diff: number, unit: string): string {
  if (diff > 0) {
    return `+${diff} ${unit}`
  }
  if (diff < 0) {
    return `${diff} ${unit}`
  }
  return `0 ${unit}`
}

export function checkCompatibility(
  baseline: StoredAttempt,
  current: StoredAttempt
): CompatibilityReport {
  const sameExercise = baseline.exerciseId === current.exerciseId

  const baseThreshold = baseline.measurements?.energy_threshold_db
  const curThreshold = current.measurements?.energy_threshold_db
  const sameDetectorThreshold =
    baseThreshold === undefined || curThreshold === undefined || baseThreshold === curThreshold

  const baseMinGap = baseline.measurements?.min_gap_duration_seconds
  const curMinGap = current.measurements?.min_gap_duration_seconds
  const sameDetectorMinGap =
    baseMinGap === undefined || curMinGap === undefined || baseMinGap === curMinGap

  const baseModel = baseline.transcript?.model_name
  const curModel = current.transcript?.model_name
  const sameRecognizerModel =
    !baseModel || !curModel || baseModel === curModel

  const warnings: string[] = []

  if (!sameExercise) {
    warnings.push(
      `Exercise mismatch: Baseline was recorded for "${baseline.exerciseTitle}", but current take is for "${current.exerciseTitle}". Acoustic and pace values reflect different text lengths.`
    )
  }

  if (!sameDetectorThreshold) {
    warnings.push(
      `Detector energy threshold differs (${baseThreshold} dBFS vs ${curThreshold} dBFS). Silence and gap intervals may reflect detector configuration rather than physical voice differences.`
    )
  }

  if (!sameDetectorMinGap) {
    warnings.push(
      `Detector minimum gap setting differs (${baseMinGap}s vs ${curMinGap}s). Pause counts may not be directly comparable.`
    )
  }

  if (!sameRecognizerModel) {
    warnings.push(
      `Recognizer model differs (${baseModel} vs ${curModel}). Word counts and WPM pace may reflect differences in ASR model accuracy.`
    )
  }

  const isCompatible =
    sameExercise && sameDetectorThreshold && sameDetectorMinGap && sameRecognizerModel

  return {
    isCompatible,
    sameExercise,
    sameDetectorThreshold,
    sameDetectorMinGap,
    sameRecognizerModel,
    warnings,
  }
}

export function computeAttemptComparison(
  baseline: StoredAttempt,
  current: StoredAttempt
): AttemptComparisonResult | null {
  if (!baseline.measurements || !current.measurements) {
    return null
  }

  const bm = baseline.measurements
  const cm = current.measurements

  const compatibility = checkCompatibility(baseline, current)

  const makeNumericItem = (
    key: string,
    label: string,
    unit: string,
    bVal: number | null,
    cVal: number | null,
    decimals = 1,
    isInteger = false,
    notes?: string,
    diffUnit?: string
  ): MetricComparisonItem => {
    const effectiveDiffUnit = diffUnit ?? unit
    if (bVal === null || cVal === null) {
      return {
        key,
        label,
        unit,
        differenceUnit: effectiveDiffUnit,
        baselineValue: bVal,
        currentValue: cVal,
        difference: null,
        formattedBaseline: bVal !== null ? `${isInteger ? bVal : bVal.toFixed(decimals)} ${unit}` : 'N/A',
        formattedCurrent: cVal !== null ? `${isInteger ? cVal : cVal.toFixed(decimals)} ${unit}` : 'N/A',
        formattedDifference: 'N/A (Transcript required)',
        notes,
      }
    }

    const diff = cVal - bVal
    const formattedDiff = isInteger
      ? formatSignedInteger(diff, effectiveDiffUnit)
      : formatSignedDifference(diff, effectiveDiffUnit, decimals)

    return {
      key,
      label,
      unit,
      differenceUnit: effectiveDiffUnit,
      baselineValue: bVal,
      currentValue: cVal,
      difference: diff,
      formattedBaseline: `${isInteger ? bVal : bVal.toFixed(decimals)} ${unit}`,
      formattedCurrent: `${isInteger ? cVal : cVal.toFixed(decimals)} ${unit}`,
      formattedDifference: formattedDiff,
      notes,
    }
  }

  const metrics = {
    recordingDuration: makeNumericItem(
      'recordingDuration',
      'Recording Duration',
      's',
      bm.total_duration_seconds,
      cm.total_duration_seconds,
      1,
      false,
      'Total length of audio from start to stop.'
    ),
    speechActiveDuration: makeNumericItem(
      'speechActiveDuration',
      'Estimated Speech-Active Time',
      's',
      bm.detected_speech_duration_seconds,
      cm.detected_speech_duration_seconds,
      1,
      false,
      'Total accumulated voice phonation duration.'
    ),
    speechActivityPercentage: makeNumericItem(
      'speechActivityPercentage',
      'Speech Activity Ratio',
      '%',
      bm.speech_activity_percentage,
      cm.speech_activity_percentage,
      1,
      false,
      'Percentage of total time containing active voice. Difference is expressed in percentage points (pp).',
      'pp'
    ),
    internalGapCount: makeNumericItem(
      'internalGapCount',
      'Internal Pause Count (≥ 250ms)',
      'gaps',
      bm.internal_gap_count,
      cm.internal_gap_count,
      0,
      true,
      'Cognitive and breathing pauses between spoken phrases.'
    ),
    totalGapDuration: makeNumericItem(
      'totalGapDuration',
      'Total Internal Pause Time',
      's',
      bm.total_internal_gap_duration_seconds,
      cm.total_internal_gap_duration_seconds,
      1,
      false,
      'Summed duration of all detected internal pauses.'
    ),
    meanGapDuration: makeNumericItem(
      'meanGapDuration',
      'Mean Internal Pause Length',
      's',
      bm.mean_internal_gap_duration_seconds,
      cm.mean_internal_gap_duration_seconds,
      1,
      false,
      'Average pause duration between speech bursts.'
    ),
    wpmTotal: makeNumericItem(
      'wpmTotal',
      'Estimated Overall Pace',
      'WPM',
      bm.words_per_minute_total,
      cm.words_per_minute_total,
      1,
      false,
      'Transcript words divided by total elapsed minutes (ASR-dependent).'
    ),
    wpmSpeechOnly: makeNumericItem(
      'wpmSpeechOnly',
      'Estimated Articulation Rate',
      'WPM',
      bm.words_per_minute_speech_only,
      cm.words_per_minute_speech_only,
      1,
      false,
      'Transcript words divided by active voice minutes only (ASR-dependent).'
    ),
  }

  return {
    baselineTakeNumber: baseline.takeNumber,
    currentTakeNumber: current.takeNumber,
    exerciseTitle: current.exerciseTitle,
    compatibility,
    metrics,
    hasTranscriptBaseline: Boolean(baseline.transcript && bm.words_per_minute_total !== null),
    hasTranscriptCurrent: Boolean(current.transcript && cm.words_per_minute_total !== null),
  }
}
