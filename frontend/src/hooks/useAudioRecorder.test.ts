import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAudioRecorder } from './useAudioRecorder'

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = []
  static isTypeSupported = vi.fn().mockReturnValue(true)

  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  start = vi.fn().mockImplementation(() => {
    this.state = 'recording'
  })
  pause = vi.fn().mockImplementation(() => {
    this.state = 'paused'
  })
  resume = vi.fn().mockImplementation(() => {
    this.state = 'recording'
  })
  stop = vi.fn().mockImplementation(() => {
    this.state = 'inactive'
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['audio-sample'], { type: this.mimeType }) })
    }
    if (this.onstop) {
      this.onstop()
    }
  })

  stream: MediaStream
  options?: MediaRecorderOptions

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream
    this.options = options
    MockMediaRecorder.instances.push(this)
  }
}

class MockAudioContext {
  static instances: MockAudioContext[] = []
  state: 'running' | 'suspended' | 'closed' = 'running'
  suspendCalls = 0
  resumeCalls = 0
  closeCalls = 0

  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 128,
      smoothingTimeConstant: 0.6,
      getByteFrequencyData: vi.fn((array: Uint8Array) => array.fill(30)),
    }
  }

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
    }
  }

  async suspend() {
    this.suspendCalls++
    this.state = 'suspended'
  }

  async resume() {
    this.resumeCalls++
    this.state = 'running'
  }

  async close() {
    this.closeCalls++
    this.state = 'closed'
  }

  constructor() {
    MockAudioContext.instances.push(this)
  }
}

describe('useAudioRecorder hook', () => {
  let mockTrack: { kind: string; enabled: boolean; stop: ReturnType<typeof vi.fn> }
  let mockStream: { getTracks: () => Array<{ kind: string; enabled: boolean; stop: ReturnType<typeof vi.fn> }> }

  beforeEach(() => {
    vi.restoreAllMocks()
    MockMediaRecorder.instances = []
    MockAudioContext.instances = []

    mockTrack = {
      kind: 'audio',
      enabled: true,
      stop: vi.fn(),
    }
    mockStream = {
      getTracks: () => [mockTrack],
    }

    Object.defineProperty(global, 'MediaRecorder', {
      value: MockMediaRecorder,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(global.window, 'AudioContext', {
      value: MockAudioContext,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    })

    global.URL.createObjectURL = vi.fn().mockImplementation(() => 'blob:mock-audio-url')
    global.URL.revokeObjectURL = vi.fn()
    global.requestAnimationFrame = vi.fn().mockReturnValue(1)
    global.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('automatically finalizes recording and releases resources at the 180s limit', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.status).toBe('recording')
    const activeRecorder = MockMediaRecorder.instances[0]
    expect(activeRecorder).toBeDefined()

    // Advance timers by 180 seconds to trigger automatic cap
    await act(async () => {
      vi.advanceTimersByTime(180_000)
    })

    expect(activeRecorder.stop).toHaveBeenCalled()
    expect(result.current.status).toBe('stopped')
    expect(result.current.elapsedSeconds).toBe(180)
    expect(result.current.audioBlob).not.toBeNull()
    expect(result.current.audioUrl).toBe('blob:mock-audio-url')
    expect(mockTrack.stop).toHaveBeenCalled()
    expect(MockAudioContext.instances[0]?.closeCalls).toBe(1)
  })

  it('handles manual stop and repeated stop gracefully', async () => {
    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.status).toBe('recording')
    const activeRecorder = MockMediaRecorder.instances[0]

    let blobResult: Blob | null = null
    await act(async () => {
      blobResult = await result.current.stopRecording()
    })

    expect(result.current.status).toBe('stopped')
    expect(blobResult).not.toBeNull()
    expect(result.current.audioBlob).toBe(blobResult)
    expect(mockTrack.stop).toHaveBeenCalled()

    // Call stopRecording again when already stopped
    let secondBlobResult: Blob | null = null
    await act(async () => {
      secondBlobResult = await result.current.stopRecording()
    })

    expect(secondBlobResult).toBe(blobResult)
    // Ensure recorder.stop was not called a second time
    expect(activeRecorder.stop).toHaveBeenCalledTimes(1)
  })

  it('reuses the existing AudioContext during pause and resume without creating duplicate instances', async () => {
    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.status).toBe('recording')
    expect(MockAudioContext.instances).toHaveLength(1)
    const audioCtx = MockAudioContext.instances[0]

    // Pause recording
    act(() => {
      result.current.pauseRecording()
    })

    expect(result.current.status).toBe('paused')
    expect(audioCtx.suspendCalls).toBe(1)
    expect(result.current.audioLevel).toBe(0)

    // Resume recording
    act(() => {
      result.current.resumeRecording()
    })

    expect(result.current.status).toBe('recording')
    expect(audioCtx.resumeCalls).toBe(1)
    // Should NOT have created a second AudioContext
    expect(MockAudioContext.instances).toHaveLength(1)

    // Repeat pause and resume
    act(() => {
      result.current.pauseRecording()
      result.current.resumeRecording()
    })

    expect(audioCtx.suspendCalls).toBe(2)
    expect(audioCtx.resumeCalls).toBe(2)
    expect(MockAudioContext.instances).toHaveLength(1)
  })

  it('releases acquired microphone tracks if recorder startup throws an error', async () => {
    class FailingMediaRecorder {
      constructor() {
        throw new Error('Hardware codec initialization error')
      }
      static isTypeSupported = vi.fn().mockReturnValue(true)
    }

    Object.defineProperty(global, 'MediaRecorder', {
      value: FailingMediaRecorder,
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error?.code).toBe('UNKNOWN')
    // Crucial invariant: acquired hardware track must be released
    expect(mockTrack.stop).toHaveBeenCalled()
  })

  it('discards recording on resetRecording without creating a preview or updating to stopped', async () => {
    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.status).toBe('recording')

    act(() => {
      result.current.resetRecording()
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.audioBlob).toBeNull()
    expect(result.current.audioUrl).toBeNull()
    expect(result.current.elapsedSeconds).toBe(0)
    expect(mockTrack.stop).toHaveBeenCalled()
  })

  it('cleans up resources and suppresses discarded callbacks on unmount during active recording', async () => {
    const { result, unmount } = renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.status).toBe('recording')

    unmount()

    expect(mockTrack.stop).toHaveBeenCalled()
    expect(MockAudioContext.instances[0]?.closeCalls).toBe(1)
    expect(global.URL.revokeObjectURL).not.toHaveBeenCalled()
  })
})
