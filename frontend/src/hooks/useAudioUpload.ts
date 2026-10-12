import { useCallback, useState } from 'react'

export interface UploadRecordingResponse {
  session_id: string
  exercise_id: string
  take_number: number
  file_id: string
  byte_size: number
  mime_type: string
  created_at: string
  status: string
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export interface UseAudioUploadReturn {
  status: UploadStatus
  error: string | null
  result: UploadRecordingResponse | null
  uploadRecording: (
    sessionId: string,
    exerciseId: string,
    takeNumber: number,
    audioBlob: Blob
  ) => Promise<boolean>
  resetUpload: () => void
}

const API_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? (import.meta.env.VITE_API_BASE_URL as string)
    : 'http://127.0.0.1:8000/api'

export function useAudioUpload(): UseAudioUploadReturn {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadRecordingResponse | null>(null)

  const resetUpload = useCallback(() => {
    setStatus('idle')
    setError(null)
    setResult(null)
  }, [])

  const uploadRecording = useCallback(
    async (
      sessionId: string,
      exerciseId: string,
      takeNumber: number,
      audioBlob: Blob
    ): Promise<boolean> => {
      // Prevent duplicate clicks if already uploading or already succeeded
      if (status === 'uploading') {
        return false
      }

      // Pre-flight client validations
      if (!audioBlob || audioBlob.size === 0) {
        setStatus('error')
        setError('Cannot upload empty audio recording.')
        return false
      }

      if (!sessionId || !sessionId.trim()) {
        setStatus('error')
        setError('Session identifier is required.')
        return false
      }

      if (!exerciseId || !exerciseId.trim()) {
        setStatus('error')
        setError('Exercise identifier is required.')
        return false
      }

      if (takeNumber < 1) {
        setStatus('error')
        setError('Take number must be at least 1.')
        return false
      }

      setStatus('uploading')
      setError(null)

      const formData = new FormData()
      formData.append('audio', audioBlob, `take_${takeNumber}.webm`)
      formData.append('exercise_id', exerciseId.trim())
      formData.append('take_number', takeNumber.toString())

      try {
        const url = `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId.trim())}/recording`
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          const errorMessage =
            data?.error?.message ||
            (Array.isArray(data?.detail)
              ? data.detail.map((d: { msg?: string }) => d.msg).join(', ')
              : data?.detail) ||
            `Upload failed with status ${response.status} (${response.statusText})`

          setStatus('error')
          setError(errorMessage)
          return false
        }

        setStatus('success')
        setResult(data as UploadRecordingResponse)
        setError(null)
        return true
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? `Network error: ${err.message}`
            : 'Unable to connect to local backend. Check if the server is running.'
        setStatus('error')
        setError(errorMsg)
        return false
      }
    },
    [status]
  )

  return {
    status,
    error,
    result,
    uploadRecording,
    resetUpload,
  }
}
