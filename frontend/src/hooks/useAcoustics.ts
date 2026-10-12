import { useCallback, useRef, useState } from 'react'

export interface AcousticGap {
  start_seconds: number
  end_seconds: number
  duration_seconds: number
}

export interface AcousticMeasurements {
  total_duration_seconds: number
  detected_speech_duration_seconds: number
  speech_activity_ratio: number
  speech_activity_percentage: number
  leading_silence_seconds: number
  trailing_silence_seconds: number
  internal_gaps: AcousticGap[]
  internal_gap_count: number
  total_internal_gap_duration_seconds: number
  mean_internal_gap_duration_seconds: number
  transcript_word_count: number | null
  words_per_minute_total: number | null
  words_per_minute_speech_only: number | null
  rate_is_transcript_dependent: boolean
  detector_type: string
  energy_threshold_db: number
  min_gap_duration_seconds: number
  sample_rate_hz: number
}

export type AcousticsStatus = 'idle' | 'analyzing' | 'completed' | 'failed'

const API_BASE_URL = 'http://127.0.0.1:8000/api'

export function useAcoustics() {
  const [status, setStatus] = useState<AcousticsStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [measurements, setMeasurements] = useState<AcousticMeasurements | null>(null)

  const activeTakeRef = useRef<number | null>(null)
  const activeSessionRef = useRef<string | null>(null)

  const resetAcoustics = useCallback(() => {
    setStatus('idle')
    setError(null)
    setMeasurements(null)
    activeTakeRef.current = null
    activeSessionRef.current = null
  }, [])

  const analyzeRecording = useCallback(
    async (sessionId: string, takeNumber: number): Promise<boolean> => {
      if (!sessionId || !sessionId.trim() || takeNumber < 1) {
        setStatus('failed')
        setError('Invalid session ID or take number.')
        return false
      }

      setStatus('analyzing')
      setError(null)
      activeTakeRef.current = takeNumber
      activeSessionRef.current = sessionId

      try {
        const response = await fetch(
          `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/recordings/${takeNumber}/acoustics`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
            },
          }
        )

        // Stale take protection: discard if user moved to another take
        if (activeTakeRef.current !== takeNumber || activeSessionRef.current !== sessionId) {
          return false
        }

        if (!response.ok) {
          let errorMsg = `Server returned HTTP ${response.status}`
          try {
            const errData = await response.json()
            if (errData?.error?.message) {
              errorMsg = errData.error.message
            }
          } catch {
            // keep fallback
          }
          setStatus('failed')
          setError(errorMsg)
          return false
        }

        const data: AcousticMeasurements = await response.json()

        // Double check stale take before commit
        if (activeTakeRef.current !== takeNumber || activeSessionRef.current !== sessionId) {
          return false
        }

        setMeasurements(data)
        setStatus('completed')
        setError(null)
        return true
      } catch (err: unknown) {
        if (activeTakeRef.current !== takeNumber || activeSessionRef.current !== sessionId) {
          return false
        }
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'Network connection failure while connecting to acoustic analysis service.'
        setStatus('failed')
        setError(errorMsg)
        return false
      }
    },
    []
  )

  return {
    status,
    error,
    measurements,
    analyzeRecording,
    resetAcoustics,
  }
}
