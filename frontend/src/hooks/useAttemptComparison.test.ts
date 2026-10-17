import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { StoredAttempt } from '../types/comparison'
import { useAttemptComparison } from './useAttemptComparison'

describe('useAttemptComparison hook', () => {
  let createdUrls: string[] = []
  let revokedUrls: string[] = []

  beforeEach(() => {
    createdUrls = []
    revokedUrls = []

    let counter = 0
    global.URL.createObjectURL = vi.fn().mockImplementation((_blob: Blob) => {
      counter++
      const url = `blob:http://localhost:5173/mock-object-url-${counter}`
      createdUrls.push(url)
      return url
    })

    global.URL.revokeObjectURL = vi.fn().mockImplementation((url: string) => {
      revokedUrls.push(url)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with baselineAttempt as null', () => {
    const { result } = renderHook(() => useAttemptComparison())
    expect(result.current.baselineAttempt).toBeNull()
  })

  it('sets baseline attempt, creating a dedicated object URL from the blob', () => {
    const { result } = renderHook(() => useAttemptComparison())

    const fakeBlob = new Blob(['mock audio data'], { type: 'audio/webm' })
    const fakeAttemptData: Omit<StoredAttempt, 'audioUrl'> = {
      takeNumber: 1,
      exerciseId: 'tech-caching',
      exerciseTitle: 'Distributed Caching',
      audioBlob: fakeBlob,
      mimeType: 'audio/webm',
      measurements: null,
      transcript: null,
      createdAt: '2026-10-17T12:00:00Z',
    }

    act(() => {
      result.current.setBaseline(fakeAttemptData)
    })

    expect(result.current.baselineAttempt).not.toBeNull()
    expect(result.current.baselineAttempt?.takeNumber).toBe(1)
    expect(result.current.baselineAttempt?.audioUrl).toMatch(/^blob:http:\/\/localhost:5173\/mock-object-url-/)
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(fakeBlob)
  })

  it('clears baseline attempt and revokes its retained object URL safely', () => {
    const { result } = renderHook(() => useAttemptComparison())

    const fakeBlob = new Blob(['mock audio data'], { type: 'audio/webm' })
    act(() => {
      result.current.setBaseline({
        takeNumber: 1,
        exerciseId: 'tech-caching',
        exerciseTitle: 'Distributed Caching',
        audioBlob: fakeBlob,
        mimeType: 'audio/webm',
        measurements: null,
        transcript: null,
        createdAt: '2026-10-17T12:00:00Z',
      })
    })

    const baselineUrl = result.current.baselineAttempt?.audioUrl
    expect(baselineUrl).toBeDefined()

    act(() => {
      result.current.clearBaseline()
    })

    expect(result.current.baselineAttempt).toBeNull()
    expect(revokedUrls).toContain(baselineUrl)
  })

  it('replaces baseline attempt by revoking previous object URL and creating a new one', () => {
    const { result } = renderHook(() => useAttemptComparison())

    const blob1 = new Blob(['take 1 audio'], { type: 'audio/webm' })
    act(() => {
      result.current.setBaseline({
        takeNumber: 1,
        exerciseId: 'tech-caching',
        exerciseTitle: 'Distributed Caching',
        audioBlob: blob1,
        mimeType: 'audio/webm',
        measurements: null,
        transcript: null,
        createdAt: '2026-10-17T12:00:00Z',
      })
    })

    const url1 = result.current.baselineAttempt?.audioUrl

    const blob2 = new Blob(['take 2 audio'], { type: 'audio/webm' })
    act(() => {
      result.current.setBaseline({
        takeNumber: 2,
        exerciseId: 'tech-caching',
        exerciseTitle: 'Distributed Caching',
        audioBlob: blob2,
        mimeType: 'audio/webm',
        measurements: null,
        transcript: null,
        createdAt: '2026-10-17T12:05:00Z',
      })
    })

    const url2 = result.current.baselineAttempt?.audioUrl
    expect(url2).not.toBe(url1)
    expect(result.current.baselineAttempt?.takeNumber).toBe(2)
    expect(revokedUrls).toContain(url1)
  })

  it('cleans up and revokes retained object URL on unmount', () => {
    const { result, unmount } = renderHook(() => useAttemptComparison())

    const blob = new Blob(['audio data'], { type: 'audio/webm' })
    act(() => {
      result.current.setBaseline({
        takeNumber: 1,
        exerciseId: 'tech-caching',
        exerciseTitle: 'Distributed Caching',
        audioBlob: blob,
        mimeType: 'audio/webm',
        measurements: null,
        transcript: null,
        createdAt: '2026-10-17T12:00:00Z',
      })
    })

    const url = result.current.baselineAttempt?.audioUrl
    expect(url).toBeDefined()

    unmount()

    expect(revokedUrls).toContain(url)
  })
})
