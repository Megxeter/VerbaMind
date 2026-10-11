import { useCallback, useEffect, useRef, useState } from 'react'
import type { MicError, MicPermissionState, RecorderState } from '../types/exercise'

const MAX_RECORDING_SECONDS = 180 // 3-minute safety limit per take

export interface UseAudioRecorderReturn {
  status: RecorderState
  permissionState: MicPermissionState
  error: MicError | null
  elapsedSeconds: number
  maxSeconds: number
  audioLevel: number // 0 to 100 for live visualizer
  audioBlob: Blob | null
  audioUrl: string | null
  mimeType: string | null
  requestPermission: () => Promise<boolean>
  startRecording: () => Promise<void>
  pauseRecording: () => void
  resumeRecording: () => void
  stopRecording: () => Promise<Blob | null>
  resetRecording: () => void
}

function getSupportedMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return ''
  }
  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac',
  ]
  for (const type of preferredTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return ''
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecorderState>('idle')
  const [permissionState, setPermissionState] = useState<MicPermissionState>('prompt')
  const [error, setError] = useState<MicError | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Map browser DOM exceptions to actionable user-friendly errors
  const handleMediaError = useCallback((err: unknown) => {
    let micErr: MicError
    const errObj = typeof err === 'object' && err !== null ? (err as { name?: string; message?: string }) : null
    const errorName = errObj?.name || (err instanceof Error ? err.name : String(err))
    const errorMsg = errObj?.message || (err instanceof Error ? err.message : 'Unknown microphone error')

    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      setPermissionState('denied')
      micErr = {
        code: 'PERMISSION_DENIED',
        message: 'Microphone access was denied.',
        remediation:
          'Click the lock or site settings icon in your browser address bar, set Microphone to "Allow", and refresh this page.',
      }
    } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      micErr = {
        code: 'DEVICE_NOT_FOUND',
        message: 'No microphone was detected on this device.',
        remediation: 'Please connect a microphone or headset and ensure it is selected in your system sound settings.',
      }
    } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      micErr = {
        code: 'BUSY',
        message: 'Your microphone is currently in use by another application.',
        remediation: 'Close other applications using audio (e.g. Zoom, Teams, Google Meet, Discord) and try again.',
      }
    } else {
      micErr = {
        code: 'UNKNOWN',
        message: `Microphone error: ${errorMsg}`,
        remediation: 'Check browser permissions and system audio settings, or reload the page.',
      }
    }

    setError(micErr)
    setStatus('error')
  }, [])

  // Clean up Web Audio analyser loop
  const stopAudioLevelAnalysis = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setAudioLevel(0)
  }, [])

  // Start real-time audio volume analysis for live visualizer
  const startAudioLevelAnalysis = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return

      const audioCtx = new AudioCtx()
      audioContextRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.6
      analyserRef.current = analyser

      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateLevel = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)

        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        // Normalize 0-255 to 0-100 with sensitivity curve
        const normalized = Math.min(100, Math.round((average / 128) * 100))
        setAudioLevel(normalized)

        animFrameRef.current = requestAnimationFrame(updateLevel)
      }

      updateLevel()
    } catch (e) {
      console.warn('AudioContext visualization initialization note:', e)
    }
  }, [])

  // Release active hardware microphone stream and audio processing nodes
  const releaseStream = useCallback(() => {
    stopAudioLevelAnalysis()
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })
      streamRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {}
    }
    mediaRecorderRef.current = null
  }, [stopAudioLevelAnalysis])

  // Explicitly request user permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError({
        code: 'UNSUPPORTED',
        message: 'Your browser does not support audio recording.',
        remediation: 'Please use a modern browser such as Chrome, Firefox, Edge, or Safari.',
      })
      setStatus('error')
      setPermissionState('unsupported')
      return false
    }

    setStatus('requesting-permission')
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      // Success: release test stream immediately
      stream.getTracks().forEach((t) => t.stop())
      setPermissionState('granted')
      setStatus('ready')
      return true
    } catch (err) {
      handleMediaError(err)
      return false
    }
  }, [handleMediaError])

  // Start recording
  const startRecording = useCallback(async () => {
    setError(null)
    chunksRef.current = []
    setElapsedSeconds(0)

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setAudioBlob(null)
    releaseStream()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      setPermissionState('granted')

      const selectedMime = getSupportedMimeType()
      const options: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {}
      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder
      setMimeType(recorder.mimeType || selectedMime || 'audio/webm')

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.start(250) // Emit slice every 250ms for reliable chunking
      setStatus('recording')
      startAudioLevelAnalysis(stream)

      // Start elapsed timer
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current)
      }
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            // Hit max cap: auto-stop
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop()
            }
            return MAX_RECORDING_SECONDS
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      handleMediaError(err)
    }
  }, [audioUrl, handleMediaError, startAudioLevelAnalysis])

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setStatus('paused')
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      stopAudioLevelAnalysis()
    }
  }, [stopAudioLevelAnalysis])

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setStatus('recording')
      if (streamRef.current) {
        startAudioLevelAnalysis(streamRef.current)
      }
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop()
            }
            return MAX_RECORDING_SECONDS
          }
          return prev + 1
        })
      }, 1000)
    }
  }, [startAudioLevelAnalysis])

  // Stop recording
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }

      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        releaseStream()
        setStatus('stopped')
        resolve(null)
        return
      }

      recorder.onstop = () => {
        const finalType = recorder.mimeType || getSupportedMimeType() || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: finalType })
        const url = URL.createObjectURL(blob)

        setAudioBlob(blob)
        setAudioUrl(url)
        setStatus('stopped')
        releaseStream()
        resolve(blob)
      }

      recorder.stop()
    })
  }, [releaseStream])

  // Reset/discard current take
  const resetRecording = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    releaseStream()
    chunksRef.current = []
    setAudioBlob(null)
    setAudioUrl(null)
    setElapsedSeconds(0)
    setAudioLevel(0)
    setError(null)
    setStatus('ready')
  }, [audioUrl, releaseStream])

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current)
      }
      releaseStream()
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl, releaseStream])

  return {
    status,
    permissionState,
    error,
    elapsedSeconds,
    maxSeconds: MAX_RECORDING_SECONDS,
    audioLevel,
    audioBlob,
    audioUrl,
    mimeType,
    requestPermission,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  }
}
