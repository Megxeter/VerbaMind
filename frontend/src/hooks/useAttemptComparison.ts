import { useCallback, useEffect, useRef, useState } from 'react'
import type { StoredAttempt } from '../types/comparison'

export interface SetBaselinePayload extends Omit<StoredAttempt, 'audioUrl'> {
  audioUrl?: string
}

export function useAttemptComparison() {
  const [baselineAttempt, setBaselineAttempt] = useState<StoredAttempt | null>(null)
  const baselineAttemptRef = useRef<StoredAttempt | null>(null)

  // Keep ref synchronized with state for safe cleanup
  baselineAttemptRef.current = baselineAttempt

  const clearBaseline = useCallback(() => {
    if (baselineAttemptRef.current?.audioUrl?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(baselineAttemptRef.current.audioUrl)
      } catch (err) {
        console.warn('Failed to revoke object URL on clear:', err)
      }
    }
    setBaselineAttempt(null)
  }, [])

  const setBaseline = useCallback((payload: SetBaselinePayload) => {
    // Revoke any previous baseline object URL if it exists
    if (baselineAttemptRef.current?.audioUrl?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(baselineAttemptRef.current.audioUrl)
      } catch (err) {
        console.warn('Failed to revoke prior baseline URL:', err)
      }
    }

    // Create a dedicated object URL from the Blob if available, so it is independent of recorder resets
    let activeUrl = payload.audioUrl || ''
    if (payload.audioBlob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      try {
        activeUrl = URL.createObjectURL(payload.audioBlob)
      } catch (err) {
        console.warn('Failed to create dedicated object URL for baseline:', err)
      }
    }

    const stored: StoredAttempt = {
      ...payload,
      audioUrl: activeUrl,
    }

    setBaselineAttempt(stored)
  }, [])

  // Safely release retained object URL when hook unmounts
  useEffect(() => {
    return () => {
      if (baselineAttemptRef.current?.audioUrl?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(baselineAttemptRef.current.audioUrl)
        } catch (err) {
          console.warn('Failed to revoke object URL on unmount:', err)
        }
      }
    }
  }, [])

  return {
    baselineAttempt,
    setBaseline,
    clearBaseline,
  }
}
