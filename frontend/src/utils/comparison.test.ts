import { describe, expect, it } from 'vitest'
import type { AcousticMeasurements } from '../hooks/useAcoustics'
import type { TranscriptData } from '../hooks/useTranscription'
import type { StoredAttempt } from '../types/comparison'
import { checkCompatibility, computeAttemptComparison } from './comparison'

function createFakeMeasurements(overrides: Partial<AcousticMeasurements> = {}): AcousticMeasurements {
  return {
    total_duration_seconds: 40.0,
    detected_speech_duration_seconds: 30.0,
    speech_activity_ratio: 0.75,
    speech_activity_percentage: 75.0,
    leading_silence_seconds: 0.5,
    trailing_silence_seconds: 0.5,
    internal_gaps: [
      { start_seconds: 5.0, end_seconds: 5.8, duration_seconds: 0.8 },
      { start_seconds: 12.0, end_seconds: 12.8, duration_seconds: 0.8 },
      { start_seconds: 20.0, end_seconds: 20.8, duration_seconds: 0.8 },
      { start_seconds: 28.0, end_seconds: 28.8, duration_seconds: 0.8 },
      { start_seconds: 35.0, end_seconds: 35.8, duration_seconds: 0.8 },
    ],
    internal_gap_count: 5,
    total_internal_gap_duration_seconds: 4.0,
    mean_internal_gap_duration_seconds: 0.8,
    transcript_word_count: 80,
    words_per_minute_total: 120.0,
    words_per_minute_speech_only: 160.0,
    rate_is_transcript_dependent: true,
    detector_type: 'energy_rms',
    energy_threshold_db: -40.0,
    min_gap_duration_seconds: 0.25,
    sample_rate_hz: 16000,
    ...overrides,
  }
}

function createFakeTranscript(overrides: Partial<TranscriptData> = {}): TranscriptData {
  return {
    text: 'Hello world sample transcript for placement coaching.',
    segments: [],
    language: 'en',
    language_probability: 1.0,
    duration_seconds: 40.0,
    processing_time_seconds: 2.1,
    model_name: 'base.en',
    device: 'cpu',
    compute_type: 'int8',
    word_count: 80,
    ...overrides,
  }
}

function createFakeAttempt(overrides: Partial<StoredAttempt> = {}): StoredAttempt {
  return {
    takeNumber: 1,
    exerciseId: 'tech-distributed-caching',
    exerciseTitle: 'System Architecture: Distributed Caching',
    audioBlob: null,
    audioUrl: 'blob:http://localhost:5173/fake-1',
    mimeType: 'audio/webm',
    measurements: createFakeMeasurements(),
    transcript: createFakeTranscript(),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('Attempt Comparison Calculations (computeAttemptComparison)', () => {
  it('computes exact side-by-side metric differences with units when both attempts are complete', () => {
    const baseline = createFakeAttempt({
      takeNumber: 1,
      measurements: createFakeMeasurements({
        total_duration_seconds: 40.0,
        detected_speech_duration_seconds: 30.0,
        speech_activity_percentage: 75.0,
        internal_gap_count: 5,
        total_internal_gap_duration_seconds: 4.0,
        mean_internal_gap_duration_seconds: 0.8,
        words_per_minute_total: 120.0,
        words_per_minute_speech_only: 160.0,
      }),
    })

    const current = createFakeAttempt({
      takeNumber: 2,
      measurements: createFakeMeasurements({
        total_duration_seconds: 42.5,
        detected_speech_duration_seconds: 34.0,
        speech_activity_percentage: 80.0,
        internal_gap_count: 3,
        total_internal_gap_duration_seconds: 2.4,
        mean_internal_gap_duration_seconds: 0.8,
        words_per_minute_total: 135.0,
        words_per_minute_speech_only: 168.0,
      }),
    })

    const result = computeAttemptComparison(baseline, current)
    expect(result).not.toBeNull()
    if (!result) return

    expect(result.baselineTakeNumber).toBe(1)
    expect(result.currentTakeNumber).toBe(2)
    expect(result.hasTranscriptBaseline).toBe(true)
    expect(result.hasTranscriptCurrent).toBe(true)

    // Duration: 42.5 - 40.0 = +2.5 s
    expect(result.metrics.recordingDuration.difference).toBeCloseTo(2.5, 1)
    expect(result.metrics.recordingDuration.formattedDifference).toBe('+2.5 s')
    expect(result.metrics.recordingDuration.unit).toBe('s')

    // Speech-active time: 34.0 - 30.0 = +4.0 s
    expect(result.metrics.speechActiveDuration.difference).toBeCloseTo(4.0, 1)
    expect(result.metrics.speechActiveDuration.formattedDifference).toBe('+4.0 s')

    // Speech activity %: 80.0 - 75.0 = +5.0 pp (percentage points)
    expect(result.metrics.speechActivityPercentage.difference).toBeCloseTo(5.0, 1)
    expect(result.metrics.speechActivityPercentage.formattedDifference).toBe('+5.0 pp')
    expect(result.metrics.speechActivityPercentage.unit).toBe('%')
    expect(result.metrics.speechActivityPercentage.differenceUnit).toBe('pp')

    // Internal gap count: 3 - 5 = -2 gaps
    expect(result.metrics.internalGapCount.difference).toBe(-2)
    expect(result.metrics.internalGapCount.formattedDifference).toBe('-2 gaps')

    // Total gap duration: 2.4 - 4.0 = -1.6 s
    expect(result.metrics.totalGapDuration.difference).toBeCloseTo(-1.6, 1)
    expect(result.metrics.totalGapDuration.formattedDifference).toBe('-1.6 s')

    // Mean gap duration: 0.8 - 0.8 = 0.0 s
    expect(result.metrics.meanGapDuration.difference).toBeCloseTo(0.0, 1)
    expect(result.metrics.meanGapDuration.formattedDifference).toBe('0.0 s')

    // WPM Total: 135.0 - 120.0 = +15.0 WPM
    expect(result.metrics.wpmTotal.difference).toBeCloseTo(15.0, 1)
    expect(result.metrics.wpmTotal.formattedDifference).toBe('+15.0 WPM')

    // Articulation WPM: 168.0 - 160.0 = +8.0 WPM
    expect(result.metrics.wpmSpeechOnly.difference).toBeCloseTo(8.0, 1)
    expect(result.metrics.wpmSpeechOnly.formattedDifference).toBe('+8.0 WPM')
  })

  it('handles unavailable transcript on current take gracefully without breaking acoustic comparison', () => {
    const baseline = createFakeAttempt({ takeNumber: 1 })
    const current = createFakeAttempt({
      takeNumber: 2,
      transcript: null,
      measurements: createFakeMeasurements({
        words_per_minute_total: null,
        words_per_minute_speech_only: null,
        transcript_word_count: null,
      }),
    })

    const result = computeAttemptComparison(baseline, current)
    expect(result).not.toBeNull()
    if (!result) return

    expect(result.hasTranscriptBaseline).toBe(true)
    expect(result.hasTranscriptCurrent).toBe(false)

    // Acoustics still compare cleanly
    expect(result.metrics.recordingDuration.difference).not.toBeNull()

    // WPM differences are marked N/A
    expect(result.metrics.wpmTotal.currentValue).toBeNull()
    expect(result.metrics.wpmTotal.difference).toBeNull()
    expect(result.metrics.wpmTotal.formattedDifference).toBe('N/A (Transcript required)')

    expect(result.metrics.wpmSpeechOnly.currentValue).toBeNull()
    expect(result.metrics.wpmSpeechOnly.difference).toBeNull()
    expect(result.metrics.wpmSpeechOnly.formattedDifference).toBe('N/A (Transcript required)')
  })

  it('handles missing measurements gracefully by returning null', () => {
    const baseline = createFakeAttempt({ measurements: null })
    const current = createFakeAttempt({ measurements: createFakeMeasurements() })

    const result = computeAttemptComparison(baseline, current)
    expect(result).toBeNull()
  })

  it('preserves scientific integrity: does NOT invent scores or label faster/fewer gaps as improvement', () => {
    const baseline = createFakeAttempt({ takeNumber: 1 })
    const current = createFakeAttempt({ takeNumber: 2 })

    const result = computeAttemptComparison(baseline, current)
    expect(result).not.toBeNull()
    if (!result) return

    // Invariant: No assessment scores, fluency grades, or ratings
    const resultKeys = Object.keys(result)
    expect(resultKeys).not.toContain('score')
    expect(resultKeys).not.toContain('grade')
    expect(resultKeys).not.toContain('fluencyScore')
    expect(resultKeys).not.toContain('improvementScore')

    // Invariant: Difference labels are neutral physical measurements, not value judgments
    expect(result.metrics.internalGapCount.formattedDifference).not.toMatch(/improved|worse|better|good|bad/i)
    expect(result.metrics.wpmTotal.formattedDifference).not.toMatch(/improved|worse|better|good|bad/i)
  })
})

describe('Compatibility Checking (checkCompatibility)', () => {
  it('flags perfect compatibility when exercises and settings match', () => {
    const baseline = createFakeAttempt({ exerciseId: 'tech-cache' })
    const current = createFakeAttempt({ exerciseId: 'tech-cache' })

    const report = checkCompatibility(baseline, current)
    expect(report.isCompatible).toBe(true)
    expect(report.sameExercise).toBe(true)
    expect(report.sameDetectorThreshold).toBe(true)
    expect(report.sameDetectorMinGap).toBe(true)
    expect(report.sameRecognizerModel).toBe(true)
    expect(report.warnings).toHaveLength(0)
  })

  it('flags exercise mismatch when attempts are recorded for different passages', () => {
    const baseline = createFakeAttempt({
      exerciseId: 'exercise-1',
      exerciseTitle: 'Exercise One',
    })
    const current = createFakeAttempt({
      exerciseId: 'exercise-2',
      exerciseTitle: 'Exercise Two',
    })

    const report = checkCompatibility(baseline, current)
    expect(report.isCompatible).toBe(false)
    expect(report.sameExercise).toBe(false)
    expect(report.warnings.some((w) => w.includes('Exercise mismatch'))).toBe(true)
  })

  it('flags detector threshold mismatch when acoustic parameters differ', () => {
    const baseline = createFakeAttempt({
      measurements: createFakeMeasurements({ energy_threshold_db: -40.0 }),
    })
    const current = createFakeAttempt({
      measurements: createFakeMeasurements({ energy_threshold_db: -35.0 }),
    })

    const report = checkCompatibility(baseline, current)
    expect(report.isCompatible).toBe(false)
    expect(report.sameDetectorThreshold).toBe(false)
    expect(report.warnings.some((w) => w.includes('threshold differs'))).toBe(true)
  })

  it('flags recognizer model divergence when transcript models differ', () => {
    const baseline = createFakeAttempt({
      transcript: createFakeTranscript({ model_name: 'base.en' }),
    })
    const current = createFakeAttempt({
      transcript: createFakeTranscript({ model_name: 'small.en' }),
    })

    const report = checkCompatibility(baseline, current)
    expect(report.sameRecognizerModel).toBe(false)
    expect(report.warnings.some((w) => w.includes('Recognizer model differs'))).toBe(true)
  })
})
