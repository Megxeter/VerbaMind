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
  if (
    typeof window === 'undefined' ||
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
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
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Lifecycle guards against stale callbacks and memory leaks
  const sessionIdRef = useRef<number>(0)
  const isDiscardedRef = useRef<boolean>(false)
  const isFinalizedRef = useRef<boolean>(false)
  const audioUrlRef = useRef<string | null>(null)
  const audioBlobRef = useRef<Blob | null>(null)
  const stopResolveRef = useRef<((blob: Blob | null) => void) | null>(null)
  const stopPromiseRef = useRef<Promise<Blob | null> | null>(null)

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

  // Clean up Web Audio animation frame loop
  const stopAudioAnimationLoop = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setAudioLevel(0)
  }, [])

  // Start the animation frame loop on an active analyser node (frequency-bin averaging)
  const startAnimationLoop = useCallback((analyser: AnalyserNode) => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

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
      // Normalize 0-255 average magnitude to 0-100 scale
      const normalized = Math.min(100, Math.round((average / 128) * 100))
      setAudioLevel(normalized)

      animFrameRef.current = requestAnimationFrame(updateLevel)
    }

    animFrameRef.current = requestAnimationFrame(updateLevel)
  }, [])

  // Initialize or resume real-time audio volume analysis without recreating AudioContexts
  const startAudioLevelAnalysis = useCallback(
    (stream: MediaStream) => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AudioCtx) return

        let audioCtx = audioContextRef.current
        if (!audioCtx || audioCtx.state === 'closed') {
          audioCtx = new AudioCtx()
          audioContextRef.current = audioCtx
        } else if (audioCtx.state === 'suspended') {
          try {
            const p = audioCtx.resume()
            if (p && typeof p.catch === 'function') {
              p.catch(() => {})
            }
          } catch {}
        }

        if (!analyserRef.current) {
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 256
          analyser.smoothingTimeConstant = 0.6
          analyserRef.current = analyser

          const source = audioCtx.createMediaStreamSource(stream)
          source.connect(analyser)
          sourceNodeRef.current = source
        }

        startAnimationLoop(analyserRef.current)
      } catch (e) {
        console.warn('AudioContext visualization initialization note:', e)
      }
    },
    [startAnimationLoop]
  )

  // Pause audio level analysis: suspend AudioContext and cancel RAF, preserving nodes for resume
  const pauseAudioLevelAnalysis = useCallback(() => {
    stopAudioAnimationLoop()
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      try {
        const p = audioContextRef.current.suspend()
        if (p && typeof p.catch === 'function') {
          p.catch(() => {})
        }
      } catch {}
    }
  }, [stopAudioAnimationLoop])

  // Resume audio level analysis reusing existing AudioContext
  const resumeAudioLevelAnalysis = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        const p = audioContextRef.current.resume()
        if (p && typeof p.catch === 'function') {
          p.catch(() => {})
        }
      } catch {}
    }
    if (analyserRef.current) {
      startAnimationLoop(analyserRef.current)
    }
  }, [startAnimationLoop])

  // Release active hardware microphone stream and close AudioContext
  const releaseStream = useCallback(() => {
    stopAudioAnimationLoop()

    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        try {
          const p = audioContextRef.current.close()
          if (p && typeof p.catch === 'function') {
            p.catch(() => {})
          }
        } catch {}
      }
      audioContextRef.current = null
    }
    analyserRef.current = null
    sourceNodeRef.current = null

    if (streamRef.current) {
      try {
        const tracks = streamRef.current.getTracks?.()
        if (Array.isArray(tracks)) {
          tracks.forEach((track) => {
            try {
              track.stop()
            } catch {}
          })
        }
      } catch {}
      streamRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {}
    }
    mediaRecorderRef.current = null
  }, [stopAudioAnimationLoop])

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
    const currentSession = ++sessionIdRef.current
    isDiscardedRef.current = false
    isFinalizedRef.current = false
    stopResolveRef.current = null
    stopPromiseRef.current = null

    setError(null)
    chunksRef.current = []
    setElapsedSeconds(0)

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    audioBlobRef.current = null
    setAudioUrl(null)
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

      // Abort if unmounted or reset during getUserMedia await
      if (sessionIdRef.current !== currentSession || isDiscardedRef.current) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop()
          } catch {}
        })
        return
      }

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

      // Attach finalisation during recorder creation so manual AND automatic stops
      // both invoke this single finalisation pipeline.
      recorder.onstop = () => {
        if (isFinalizedRef.current) return
        isFinalizedRef.current = true

        if (timerIntervalRef.current !== null) {
          window.clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = null
        }

        // If discarded or session superseded, do not create preview or set state
        if (isDiscardedRef.current || sessionIdRef.current !== currentSession) {
          releaseStream()
          if (stopResolveRef.current) {
            stopResolveRef.current(null)
            stopResolveRef.current = null
          }
          stopPromiseRef.current = null
          return
        }

        const finalType = recorder.mimeType || getSupportedMimeType() || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: finalType })

        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current)
          audioUrlRef.current = null
        }
        const url = URL.createObjectURL(blob)
        audioUrlRef.current = url
        audioBlobRef.current = blob

        setAudioBlob(blob)
        setAudioUrl(url)
        setStatus('stopped')
        releaseStream()

        if (stopResolveRef.current) {
          stopResolveRef.current(blob)
          stopResolveRef.current = null
        }
        stopPromiseRef.current = null
      }

      recorder.start(250) // Emit slice every 250ms for reliable chunking
      setStatus('recording')
      startAudioLevelAnalysis(stream)

      // Start elapsed timer with 180s automatic cap
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current)
      }
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            if (timerIntervalRef.current !== null) {
              window.clearInterval(timerIntervalRef.current)
              timerIntervalRef.current = null
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              try {
                mediaRecorderRef.current.stop()
              } catch {}
            }
            return MAX_RECORDING_SECONDS
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      // Ensure any acquired microphone tracks are released if recorder init/start fails
      releaseStream()
      handleMediaError(err)
    }
  }, [handleMediaError, releaseStream, startAudioLevelAnalysis])

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause()
      } catch {}
      setStatus('paused')
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      pauseAudioLevelAnalysis()
    }
  }, [pauseAudioLevelAnalysis])

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try {
        mediaRecorderRef.current.resume()
      } catch {}
      setStatus('recording')
      resumeAudioLevelAnalysis()

      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current)
      }
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            if (timerIntervalRef.current !== null) {
              window.clearInterval(timerIntervalRef.current)
              timerIntervalRef.current = null
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              try {
                mediaRecorderRef.current.stop()
              } catch {}
            }
            return MAX_RECORDING_SECONDS
          }
          return prev + 1
        })
      }, 1000)
    }
  }, [resumeAudioLevelAnalysis])

  // Stop recording: supports manual stop and handles repeated invocations gracefully
  const stopRecording = useCallback((): Promise<Blob | null> => {
    if (stopPromiseRef.current) {
      return stopPromiseRef.current
    }

    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      releaseStream()
      if (status !== 'stopped') {
        setStatus('stopped')
      }
      return Promise.resolve(audioBlobRef.current)
    }

    const promise = new Promise<Blob | null>((resolve) => {
      stopResolveRef.current = resolve
      try {
        recorder.stop()
      } catch {
        releaseStream()
        setStatus('stopped')
        resolve(null)
      }
    })

    stopPromiseRef.current = promise
    return promise
  }, [releaseStream, status])

  // Reset/discard current take
  const resetRecording = useCallback(() => {
    isDiscardedRef.current = true
    sessionIdRef.current++

    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    releaseStream()
    chunksRef.current = []
    audioBlobRef.current = null
    setAudioBlob(null)
    setAudioUrl(null)
    setElapsedSeconds(0)
    setAudioLevel(0)
    setError(null)
    setStatus('ready')

    if (stopResolveRef.current) {
      stopResolveRef.current(null)
      stopResolveRef.current = null
    }
    stopPromiseRef.current = null
  }, [releaseStream])

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      isDiscardedRef.current = true
      sessionIdRef.current++

      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      releaseStream()
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }
      if (stopResolveRef.current) {
        stopResolveRef.current(null)
        stopResolveRef.current = null
      }
      stopPromiseRef.current = null
    }
  }, [releaseStream])

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

