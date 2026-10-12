import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type AcousticMeasurements, useAcoustics } from './useAcoustics'

const mockMeasurements: AcousticMeasurements = {
  total_duration_seconds: 47.16,
  detected_speech_duration_seconds: 41.01,
  speech_activity_ratio: 0.87,
  speech_activity_percentage: 87.0,
  leading_silence_seconds: 0.44,
  trailing_silence_seconds: 0.7,
  internal_gaps: [
    { start_seconds: 0.58, end_seconds: 1.53, duration_seconds: 0.94 },
    { start_seconds: 6.12, end_seconds: 6.73, duration_seconds: 0.61 },
  ],
  internal_gap_count: 2,
  total_internal_gap_duration_seconds: 1.55,
  mean_internal_gap_duration_seconds: 0.78,
  transcript_word_count: 94,
  words_per_minute_total: 119.6,
  words_per_minute_speech_only: 137.5,
  rate_is_transcript_dependent: true,
  detector_type: 'frame_energy_rms',
  energy_threshold_db: -40.0,
  min_gap_duration_seconds: 0.25,
  sample_rate_hz: 16000,
}

describe('useAcoustics Hook', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('initializes in idle state with null measurements and error', () => {
    const { result } = renderHook(() => useAcoustics())
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.measurements).toBeNull()
  })

  it('rejects invalid parameters before making network request', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    const { result } = renderHook(() => useAcoustics())

    let res = false
    await act(async () => {
      res = await result.current.analyzeRecording('', 1)
    })

    expect(res).toBe(false)
    expect(result.current.status).toBe('failed')
    expect(result.current.error).toContain('Invalid session ID')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('handles successful acoustic analysis workflow', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMeasurements,
    })

    const { result } = renderHook(() => useAcoustics())

    let res = false
    await act(async () => {
      res = await result.current.analyzeRecording('sess_123', 1)
    })

    expect(res).toBe(true)
    expect(result.current.status).toBe('completed')
    expect(result.current.error).toBeNull()
    expect(result.current.measurements).toEqual(mockMeasurements)
    expect(result.current.measurements?.speech_activity_percentage).toBe(87.0)
    expect(result.current.measurements?.internal_gap_count).toBe(2)
  })

  it('handles API error responses gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: { code: 'RECORDING_NOT_FOUND', message: 'No recording found.' },
      }),
    })

    const { result } = renderHook(() => useAcoustics())

    let res = false
    await act(async () => {
      res = await result.current.analyzeRecording('sess_123', 1)
    })

    expect(res).toBe(false)
    expect(result.current.status).toBe('failed')
    expect(result.current.error).toBe('No recording found.')
    expect(result.current.measurements).toBeNull()
  })

  it('handles network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useAcoustics())

    let res = false
    await act(async () => {
      res = await result.current.analyzeRecording('sess_123', 1)
    })

    expect(res).toBe(false)
    expect(result.current.status).toBe('failed')
    expect(result.current.error).toBe('Failed to fetch')
  })

  it('discards responses from stale take if take changes during analysis', async () => {
    let resolveFirstFetch: (value: unknown) => void = () => {}
    const firstFetchPromise = new Promise((resolve) => {
      resolveFirstFetch = resolve
    })

    globalThis.fetch = vi.fn().mockImplementation(() => firstFetchPromise)

    const { result } = renderHook(() => useAcoustics())

    // Start analysis for take 1
    act(() => {
      result.current.analyzeRecording('sess_123', 1)
    })
    expect(result.current.status).toBe('analyzing')

    // User switches to take 2 and calls reset
    act(() => {
      result.current.resetAcoustics()
    })
    expect(result.current.status).toBe('idle')

    // First fetch resolves late
    await act(async () => {
      resolveFirstFetch({
        ok: true,
        json: async () => mockMeasurements,
      })
    })

    // State should still be idle, measurements not populated from stale take
    expect(result.current.status).toBe('idle')
    expect(result.current.measurements).toBeNull()
  })
})
