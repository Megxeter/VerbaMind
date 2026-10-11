import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAudioRecorder } from './useAudioRecorder'

describe('useAudioRecorder hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with idle state and prompt permission', () => {
    const { result } = renderHook(() => useAudioRecorder())

    expect(result.current.status).toBe('idle')
    expect(result.current.permissionState).toBe('prompt')
    expect(result.current.error).toBeNull()
    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.audioBlob).toBeNull()
    expect(result.current.audioUrl).toBeNull()
  })

  it('handles permission denial gracefully and sets actionable error', async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue({
      name: 'NotAllowedError',
      message: 'Permission denied',
    })

    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
    })

    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => {
      const granted = await result.current.requestPermission()
      expect(granted).toBe(false)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.permissionState).toBe('denied')
    expect(result.current.error?.code).toBe('PERMISSION_DENIED')
    expect(result.current.error?.remediation).toContain('address bar')
  })

  it('handles missing microphone device gracefully', async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue({
      name: 'NotFoundError',
      message: 'No device',
    })

    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
    })

    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.requestPermission()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error?.code).toBe('DEVICE_NOT_FOUND')
    expect(result.current.error?.remediation).toContain('connect a microphone')
  })

  it('resets error and timer on resetRecording', () => {
    const { result } = renderHook(() => useAudioRecorder())

    act(() => {
      result.current.resetRecording()
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.error).toBeNull()
  })
})
