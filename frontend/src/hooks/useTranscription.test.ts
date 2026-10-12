import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type TranscriptData, useTranscription } from './useTranscription'

const mockTranscript: TranscriptData = {
  text: 'Hello world distributed caching test.',
  segments: [
    {
      id: 1,
      start: 0.5,
      end: 2.5,
      text: 'Hello world distributed caching test.',
      words: [
        { word: 'Hello', start: 0.5, end: 0.9, probability: 0.98 },
        { word: 'world', start: 0.95, end: 1.3, probability: 0.95 },
      ],
    },
  ],
  language: 'en',
  language_probability: 1.0,
  duration_seconds: 3.0,
  processing_time_seconds: 0.25,
  model_name: 'base.en',
  device: 'cpu',
  compute_type: 'int8',
  word_count: 5,
}

describe('useTranscription Hook', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.useRealTimers()
  })

  it('initializes in idle state with null result and error', () => {
    const { result } = renderHook(() => useTranscription())
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.transcript).toBeNull()
    expect(result.current.job).toBeNull()
  })

  it('rejects invalid parameters before making network request', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    const { result } = renderHook(() => useTranscription())

    let res = false
    await act(async () => {
      res = await result.current.startTranscription('', 1)
    })

    expect(res).toBe(false)
    expect(result.current.status).toBe('failed')
    expect(result.current.error).toContain('Session identifier is required')
    expect(fetchSpy).not.toHaveBeenCalled()

    await act(async () => {
      res = await result.current.startTranscription('sess_123', 0)
    })

    expect(res).toBe(false)
    expect(result.current.status).toBe('failed')
    expect(result.current.error).toContain('Take number must be at least 1')
  })

  it('completes immediately if backend returns completed transcript on POST', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        job_id: 'job_123',
        session_id: 'sess_123',
        take_number: 1,
        status: 'completed',
        transcript: mockTranscript,
      }),
    })
    globalThis.fetch = fetchSpy

    const { result } = renderHook(() => useTranscription())

    let success = false
    await act(async () => {
      success = await result.current.startTranscription('sess_123', 1)
    })

    expect(success).toBe(true)
    expect(result.current.status).toBe('completed')
    expect(result.current.transcript).toEqual(mockTranscript)
    expect(result.current.error).toBeNull()
  })

  it('transitions queued -> processing -> completed via polling', async () => {
    // 1. Initial POST returns 202 queued
    // 2. First GET poll returns processing
    // 3. Second GET poll returns completed
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({
          job_id: 'job_polled',
          session_id: 'sess_polled',
          take_number: 1,
          status: 'queued',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          job_id: 'job_polled',
          session_id: 'sess_polled',
          take_number: 1,
          status: 'processing',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          job_id: 'job_polled',
          session_id: 'sess_polled',
          take_number: 1,
          status: 'completed',
          transcript: mockTranscript,
        }),
      })

    globalThis.fetch = fetchSpy

    const { result } = renderHook(() => useTranscription())

    await act(async () => {
      await result.current.startTranscription('sess_polled', 1)
    })

    expect(result.current.status).toBe('queued')

    // Advance timer to trigger first poll
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current.status).toBe('processing')

    // Advance timer to trigger second poll
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current.status).toBe('completed')
    expect(result.current.transcript?.text).toBe(mockTranscript.text)
    expect(result.current.error).toBeNull()
  })

  it('handles backend worker failure during polling', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({
          job_id: 'job_fail',
          session_id: 'sess_fail',
          take_number: 1,
          status: 'queued',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          job_id: 'job_fail',
          session_id: 'sess_fail',
          take_number: 1,
          status: 'failed',
          error: 'Corrupt audio data',
        }),
      })

    globalThis.fetch = fetchSpy

    const { result } = renderHook(() => useTranscription())

    await act(async () => {
      await result.current.startTranscription('sess_fail', 1)
    })

    expect(result.current.status).toBe('queued')

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current.status).toBe('failed')
    expect(result.current.error).toBe('Corrupt audio data')
    expect(result.current.transcript).toBeNull()
  })

  it('resetTranscription clears state and aborts active polling', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        job_id: 'job_reset',
        session_id: 'sess_reset',
        take_number: 1,
        status: 'queued',
      }),
    })
    globalThis.fetch = fetchSpy

    const { result } = renderHook(() => useTranscription())

    await act(async () => {
      await result.current.startTranscription('sess_reset', 1)
    })
    expect(result.current.status).toBe('queued')

    act(() => {
      result.current.resetTranscription()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.transcript).toBeNull()
    expect(result.current.error).toBeNull()

    // Advancing timer should not call fetch again because polling was cleared
    fetchSpy.mockClear()
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
