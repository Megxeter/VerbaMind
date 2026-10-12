import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAudioUpload } from './useAudioUpload'

describe('useAudioUpload Hook', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('initializes in idle state with null result and error', () => {
    const { result } = renderHook(() => useAudioUpload())
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.result).toBeNull()
  })

  it('rejects empty audio blob before dispatching network request', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    const { result } = renderHook(() => useAudioUpload())
    const emptyBlob = new Blob([], { type: 'audio/webm' })

    let success = false
    await act(async () => {
      success = await result.current.uploadRecording('sess_123', 'ex_intro', 1, emptyBlob)
    })

    expect(success).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('Cannot upload empty audio')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects invalid identifiers before dispatching network request', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    const { result } = renderHook(() => useAudioUpload())
    const validBlob = new Blob(['valid audio content'], { type: 'audio/webm' })

    let success = false
    await act(async () => {
      success = await result.current.uploadRecording('', 'ex_intro', 1, validBlob)
    })

    expect(success).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('Session identifier is required')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('handles successful recording upload', async () => {
    const mockSuccessResponse = {
      session_id: 'sess_valid',
      exercise_id: 'tech-caching',
      take_number: 1,
      file_id: 'take_1.webm',
      byte_size: 1024,
      mime_type: 'audio/webm',
      created_at: '2026-10-12T12:00:00Z',
      status: 'uploaded',
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockSuccessResponse,
    })

    const { result } = renderHook(() => useAudioUpload())
    const validBlob = new Blob(['sample-audio-bytes'], { type: 'audio/webm' })

    let success = false
    await act(async () => {
      success = await result.current.uploadRecording('sess_valid', 'tech-caching', 1, validBlob)
    })

    expect(success).toBe(true)
    expect(result.current.status).toBe('success')
    expect(result.current.error).toBeNull()
    expect(result.current.result).toEqual(mockSuccessResponse)
  })

  it('handles backend conflict (409) gracefully with server error message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({
        error: {
          code: 'TAKE_ALREADY_EXISTS',
          message: "A recording for session 'sess_dup' take 1 already exists.",
        },
      }),
    })

    const { result } = renderHook(() => useAudioUpload())
    const validBlob = new Blob(['sample-audio-bytes'], { type: 'audio/webm' })

    let success = false
    await act(async () => {
      success = await result.current.uploadRecording('sess_dup', 'tech-caching', 1, validBlob)
    })

    expect(success).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain("A recording for session 'sess_dup' take 1 already exists")
    expect(result.current.result).toBeNull()
  })

  it('handles network failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useAudioUpload())
    const validBlob = new Blob(['sample-audio-bytes'], { type: 'audio/webm' })

    let success = false
    await act(async () => {
      success = await result.current.uploadRecording('sess_net', 'tech-caching', 1, validBlob)
    })

    expect(success).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('Network error: Failed to fetch')
  })

  it('resets upload state on resetUpload()', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Server error'))

    const { result } = renderHook(() => useAudioUpload())
    const validBlob = new Blob(['sample-audio-bytes'], { type: 'audio/webm' })

    await act(async () => {
      await result.current.uploadRecording('sess_reset', 'tech-caching', 1, validBlob)
    })
    expect(result.current.status).toBe('error')

    act(() => {
      result.current.resetUpload()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })
})
