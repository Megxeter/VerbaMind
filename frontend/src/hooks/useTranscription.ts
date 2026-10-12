import { useCallback, useEffect, useRef, useState } from 'react'

export interface WordTiming {
  word: string
  start: number
  end: number
  probability: number
}

export interface SegmentTiming {
  id: number
  seek?: number
  start: number
  end: number
  text: string
  words?: WordTiming[]
}

export interface TranscriptData {
  text: string
  segments: SegmentTiming[]
  language: string
  language_probability: number
  duration_seconds: number
  processing_time_seconds: number
  model_name: string
  device: string
  compute_type: string
  word_count: number
}

export interface TranscriptionJobResponse {
  job_id?: string
  session_id: string
  take_number: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  queued_at?: string
  started_at?: string | null
  completed_at?: string | null
  model_name?: string
  device?: string
  compute_type?: string
  error?: string | null
  transcript?: TranscriptData | null
}

export type TranscriptionStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed'

export interface UseTranscriptionReturn {
  status: TranscriptionStatus
  error: string | null
  transcript: TranscriptData | null
  job: TranscriptionJobResponse | null
  startTranscription: (sessionId: string, takeNumber: number) => Promise<boolean>
  resetTranscription: () => void
}

const API_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? (import.meta.env.VITE_API_BASE_URL as string)
    : 'http://127.0.0.1:8000/api'

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 60 // 60 * 1.5s = 90s safety ceiling

export function useTranscription(): UseTranscriptionReturn {
  const [status, setStatus] = useState<TranscriptionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptData | null>(null)
  const [job, setJob] = useState<TranscriptionJobResponse | null>(null)

  // Track active target to prevent stale updates across takes
  const activeTargetRef = useRef<{ sessionId: string; takeNumber: number } | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollCountRef = useRef<number>(0)

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    pollCountRef.current = 0
  }, [])

  const resetTranscription = useCallback(() => {
    clearPolling()
    activeTargetRef.current = null
    setStatus('idle')
    setError(null)
    setTranscript(null)
    setJob(null)
  }, [clearPolling])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPolling()
    }
  }, [clearPolling])

  const pollJobStatus = useCallback(
    async (sessionId: string, takeNumber: number) => {
      // Validate still targeting this specific take
      if (
        !activeTargetRef.current ||
        activeTargetRef.current.sessionId !== sessionId ||
        activeTargetRef.current.takeNumber !== takeNumber
      ) {
        return
      }

      pollCountRef.current += 1
      if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
        clearPolling()
        setStatus('failed')
        setError('Transcription timed out. The backend worker may be busy or restarted.')
        return
      }

      try {
        const url = `${API_BASE_URL}/sessions/${encodeURIComponent(
          sessionId.trim()
        )}/recordings/${takeNumber}/transcript`
        const response = await fetch(url)
        const data = await response.json().catch(() => null)

        // Ignore stale responses if take changed mid-flight
        if (
          !activeTargetRef.current ||
          activeTargetRef.current.sessionId !== sessionId ||
          activeTargetRef.current.takeNumber !== takeNumber
        ) {
          return
        }

        if (!response.ok) {
          clearPolling()
          const errorMessage =
            data?.error?.message ||
            `Failed to query transcription status (${response.status})`
          setStatus('failed')
          setError(errorMessage)
          return
        }

        const jobResponse = data as TranscriptionJobResponse
        setJob(jobResponse)

        if (jobResponse.status === 'completed' && jobResponse.transcript) {
          clearPolling()
          setStatus('completed')
          setTranscript(jobResponse.transcript)
          setError(null)
        } else if (jobResponse.status === 'failed') {
          clearPolling()
          setStatus('failed')
          setError(jobResponse.error || 'Speech transcription failed on worker.')
        } else {
          // Still queued or processing
          setStatus(jobResponse.status)
          pollTimerRef.current = setTimeout(() => {
            void pollJobStatus(sessionId, takeNumber)
          }, POLL_INTERVAL_MS)
        }
      } catch (err: unknown) {
        // Ignore stale network errors
        if (
          !activeTargetRef.current ||
          activeTargetRef.current.sessionId !== sessionId ||
          activeTargetRef.current.takeNumber !== takeNumber
        ) {
          return
        }

        // Allow retry on transient network hiccup up to max attempts
        if (pollCountRef.current < MAX_POLL_ATTEMPTS) {
          pollTimerRef.current = setTimeout(() => {
            void pollJobStatus(sessionId, takeNumber)
          }, POLL_INTERVAL_MS)
        } else {
          clearPolling()
          setStatus('failed')
          setError(
            err instanceof Error
              ? `Network error while polling: ${err.message}`
              : 'Unable to communicate with local backend server.'
          )
        }
      }
    },
    [clearPolling]
  )

  const startTranscription = useCallback(
    async (sessionId: string, takeNumber: number): Promise<boolean> => {
      if (status === 'queued' || status === 'processing') {
        return false
      }

      if (!sessionId || !sessionId.trim()) {
        setStatus('failed')
        setError('Session identifier is required.')
        return false
      }

      if (takeNumber < 1) {
        setStatus('failed')
        setError('Take number must be at least 1.')
        return false
      }

      clearPolling()
      const target = { sessionId: sessionId.trim(), takeNumber }
      activeTargetRef.current = target

      setStatus('queued')
      setError(null)
      setTranscript(null)
      setJob(null)

      try {
        const url = `${API_BASE_URL}/sessions/${encodeURIComponent(
          target.sessionId
        )}/recordings/${takeNumber}/transcribe`
        const response = await fetch(url, {
          method: 'POST',
        })

        const data = await response.json().catch(() => null)

        // Stale target check
        if (
          !activeTargetRef.current ||
          activeTargetRef.current.sessionId !== target.sessionId ||
          activeTargetRef.current.takeNumber !== target.takeNumber
        ) {
          return false
        }

        if (!response.ok) {
          const errorMessage =
            data?.error?.message ||
            `Failed to start transcription (${response.status} ${response.statusText})`
          setStatus('failed')
          setError(errorMessage)
          return false
        }

        const jobResponse = data as TranscriptionJobResponse
        setJob(jobResponse)

        if (jobResponse.status === 'completed' && jobResponse.transcript) {
          setStatus('completed')
          setTranscript(jobResponse.transcript)
          setError(null)
          return true
        }

        if (jobResponse.status === 'failed') {
          setStatus('failed')
          setError(jobResponse.error || 'Speech transcription failed.')
          return false
        }

        // Job is queued or processing -> start polling
        setStatus(jobResponse.status)
        pollTimerRef.current = setTimeout(() => {
          void pollJobStatus(target.sessionId, target.takeNumber)
        }, POLL_INTERVAL_MS)

        return true
      } catch (err: unknown) {
        if (
          !activeTargetRef.current ||
          activeTargetRef.current.sessionId !== target.sessionId ||
          activeTargetRef.current.takeNumber !== target.takeNumber
        ) {
          return false
        }

        setStatus('failed')
        setError(
          err instanceof Error
            ? `Network error: ${err.message}`
            : 'Unable to connect to local backend server.'
        )
        return false
      }
    },
    [clearPolling, pollJobStatus, status]
  )

  return {
    status,
    error,
    transcript,
    job,
    startTranscription,
    resetTranscription,
  }
}
