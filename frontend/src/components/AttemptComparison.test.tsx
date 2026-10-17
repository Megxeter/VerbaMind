import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AcousticMeasurements } from '../hooks/useAcoustics'
import type { TranscriptData } from '../hooks/useTranscription'
import type { StoredAttempt } from '../types/comparison'
import { AttemptComparison } from './AttemptComparison'

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
    ],
    internal_gap_count: 2,
    total_internal_gap_duration_seconds: 1.6,
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
    text: 'Hello world placement passage.',
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
    audioUrl: 'blob:http://localhost:5173/fake-take',
    mimeType: 'audio/webm',
    measurements: createFakeMeasurements(),
    transcript: createFakeTranscript(),
    createdAt: '2026-10-17T12:00:00Z',
    ...overrides,
  }
}

describe('AttemptComparison Component', () => {
  it('renders side-by-side comparison table with metric differences and units', () => {
    const baseline = createFakeAttempt({
      takeNumber: 1,
      measurements: createFakeMeasurements({
        total_duration_seconds: 40.0,
        detected_speech_duration_seconds: 30.0,
        speech_activity_percentage: 75.0,
        internal_gap_count: 5,
        total_internal_gap_duration_seconds: 4.0,
        words_per_minute_total: 120.0,
      }),
    })

    const current = createFakeAttempt({
      takeNumber: 2,
      measurements: createFakeMeasurements({
        total_duration_seconds: 45.0,
        detected_speech_duration_seconds: 36.0,
        speech_activity_percentage: 80.0,
        internal_gap_count: 3,
        total_internal_gap_duration_seconds: 2.4,
        words_per_minute_total: 135.0,
      }),
    })

    const onSelectAudioTrack = vi.fn()
    const onReplaceBaseline = vi.fn()
    const onClearBaseline = vi.fn()

    render(
      <AttemptComparison
        baselineAttempt={baseline}
        currentAttempt={current}
        activeAudioTrack="current"
        onSelectAudioTrack={onSelectAudioTrack}
        onReplaceBaseline={onReplaceBaseline}
        onClearBaseline={onClearBaseline}
      />
    )

    // Heading and take identifiers
    expect(screen.getByText(/Same-Exercise Attempt Comparison/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Take #1/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Take #2/).length).toBeGreaterThanOrEqual(1)

    // Numeric differences with units
    expect(screen.getByText('+5.0 s')).toBeInTheDocument()
    expect(screen.getByText('+6.0 s')).toBeInTheDocument()
    expect(screen.getByText('+5.0 pp')).toBeInTheDocument()
    expect(screen.getByText('-2 gaps')).toBeInTheDocument()
    expect(screen.getByText('-1.6 s')).toBeInTheDocument()
    expect(screen.getByText('+15.0 WPM')).toBeInTheDocument()

    // Scientific and session disclaimers
    expect(screen.getByText(/Measurement vs. Assessment/i)).toBeInTheDocument()
    expect(screen.getByText(/Session-Only Memory/i)).toBeInTheDocument()
  })

  it('switches active playback track using single audio player controls', () => {
    const baseline = createFakeAttempt({ takeNumber: 1 })
    const current = createFakeAttempt({ takeNumber: 2 })
    const onSelectAudioTrack = vi.fn()

    render(
      <AttemptComparison
        baselineAttempt={baseline}
        currentAttempt={current}
        activeAudioTrack="current"
        onSelectAudioTrack={onSelectAudioTrack}
        onReplaceBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />
    )

    const listenBaselineBtn = screen.getByRole('button', { name: /Listen to Take #1/i })
    fireEvent.click(listenBaselineBtn)

    expect(onSelectAudioTrack).toHaveBeenCalledWith('baseline')
  })

  it('triggers onReplaceBaseline and onClearBaseline callbacks when buttons are clicked', () => {
    const baseline = createFakeAttempt({ takeNumber: 1 })
    const current = createFakeAttempt({ takeNumber: 2 })
    const onReplaceBaseline = vi.fn()
    const onClearBaseline = vi.fn()

    render(
      <AttemptComparison
        baselineAttempt={baseline}
        currentAttempt={current}
        activeAudioTrack="current"
        onSelectAudioTrack={vi.fn()}
        onReplaceBaseline={onReplaceBaseline}
        onClearBaseline={onClearBaseline}
      />
    )

    const updateBtn = screen.getByRole('button', { name: /Update Baseline to Take #2/i })
    fireEvent.click(updateBtn)
    expect(onReplaceBaseline).toHaveBeenCalled()

    const clearBtn = screen.getByRole('button', { name: /Clear Baseline/i })
    fireEvent.click(clearBtn)
    expect(onClearBaseline).toHaveBeenCalled()
  })

  it('displays compatibility warning when exercises differ', () => {
    const baseline = createFakeAttempt({
      takeNumber: 1,
      exerciseId: 'exercise-1',
      exerciseTitle: 'Exercise One',
    })
    const current = createFakeAttempt({
      takeNumber: 2,
      exerciseId: 'exercise-2',
      exerciseTitle: 'Exercise Two',
    })

    render(
      <AttemptComparison
        baselineAttempt={baseline}
        currentAttempt={current}
        activeAudioTrack="current"
        onSelectAudioTrack={vi.fn()}
        onReplaceBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />
    )

    expect(screen.getByText(/Exercise mismatch/i)).toBeInTheDocument()
  })

  it('displays N/A when transcript is missing for current take without breaking', () => {
    const baseline = createFakeAttempt({ takeNumber: 1 })
    const current = createFakeAttempt({
      takeNumber: 2,
      transcript: null,
      measurements: createFakeMeasurements({
        words_per_minute_total: null,
        words_per_minute_speech_only: null,
      }),
    })

    render(
      <AttemptComparison
        baselineAttempt={baseline}
        currentAttempt={current}
        activeAudioTrack="current"
        onSelectAudioTrack={vi.fn()}
        onReplaceBaseline={vi.fn()}
        onClearBaseline={vi.fn()}
      />
    )

    const transcriptReqBadges = screen.getAllByText(/N\/A \(Transcript required\)/i)
    expect(transcriptReqBadges.length).toBeGreaterThanOrEqual(1)
  })
})
