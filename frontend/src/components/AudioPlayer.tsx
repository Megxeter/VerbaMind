import React, { useEffect, useRef, useState } from 'react'
import { useAudioUpload } from '../hooks/useAudioUpload'
import { useTranscription } from '../hooks/useTranscription'

interface AudioPlayerProps {
  audioUrl: string
  audioBlob: Blob | null
  mimeType: string | null
  exerciseTitle: string
  exerciseId: string
  sessionId: string
  takeNumber: number
  onRecordAnotherTake: () => void
}

function formatPlayerTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  audioBlob,
  mimeType,
  exerciseTitle,
  exerciseId,
  sessionId,
  takeNumber,
  onRecordAnotherTake,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showSegments, setShowSegments] = useState(false)

  const {
    status: uploadStatus,
    error: uploadError,
    result: uploadResult,
    uploadRecording,
    resetUpload,
  } = useAudioUpload()

  const {
    status: transcriptionStatus,
    error: transcriptionError,
    transcript,
    startTranscription,
    resetTranscription,
  } = useTranscription()

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [audioUrl])

  // Reset upload and transcription status when audio URL changes (new take recorded)
  useEffect(() => {
    resetUpload()
    resetTranscription()
    setShowSegments(false)
  }, [audioUrl, resetUpload, resetTranscription])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('Audio play error:', err))
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime
      setCurrentTime(targetTime)
    }
  }

  const handleDownload = () => {
    if (!audioBlob && !audioUrl) return
    const a = document.createElement('a')
    a.href = audioUrl
    const extension = mimeType?.includes('ogg') ? 'ogg' : mimeType?.includes('mp4') ? 'm4a' : 'webm'
    a.download = `verbamind_take_${takeNumber}_${Date.now()}.${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleUpload = async () => {
    if (!audioBlob) return
    await uploadRecording(sessionId, exerciseId, takeNumber, audioBlob)
  }

  const handleTranscribe = async () => {
    await startTranscription(sessionId, takeNumber)
  }

  const handleNextTake = () => {
    resetUpload()
    resetTranscription()
    setShowSegments(false)
    onRecordAnotherTake()
  }

  const sizeKb = audioBlob ? Math.round(audioBlob.size / 1024) : 0

  return (
    <div className="audio-player-card">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="player-top-row">
        <div className="player-meta">
          <div className="player-badge-group">
            <span className="badge badge-success">Take #{takeNumber} Captured</span>
            <span className="player-filesize">{sizeKb} KB ({mimeType || 'audio/webm'})</span>
          </div>
          <h4 className="player-title">{exerciseTitle}</h4>
        </div>

        <div className="player-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownload}
            title="Download audio recording to your computer"
            id="download-recording-btn"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>

          {/* Upload Action States */}
          {uploadStatus === 'idle' && (
            <button
              type="button"
              className="btn btn-primary btn-sm btn-upload"
              onClick={handleUpload}
              title="Upload recording to local backend storage"
              id="upload-recording-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Recording
            </button>
          )}

          {uploadStatus === 'uploading' && (
            <button
              type="button"
              className="btn btn-primary btn-sm btn-upload"
              disabled
              id="upload-recording-btn"
            >
              <span className="spinner-inline" aria-hidden="true" />
              Uploading Take #{takeNumber}...
            </button>
          )}

          {uploadStatus === 'success' && (
            <button
              type="button"
              className="btn btn-success-subtle btn-sm btn-upload"
              disabled
              id="upload-recording-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Take #{takeNumber} Uploaded
            </button>
          )}

          {uploadStatus === 'error' && (
            <button
              type="button"
              className="btn btn-danger btn-sm btn-upload"
              onClick={handleUpload}
              title="Retry uploading this take"
              id="upload-recording-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Retry Upload
            </button>
          )}

          {/* Transcription Action States (Accessible after successful upload) */}
          {uploadStatus === 'success' && transcriptionStatus === 'idle' && (
            <button
              type="button"
              className="btn btn-transcribe btn-sm"
              onClick={handleTranscribe}
              title="Transcribe speech locally using offline Whisper model"
              id="transcribe-speech-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              Transcribe Speech
            </button>
          )}

          {uploadStatus === 'success' && (transcriptionStatus === 'queued' || transcriptionStatus === 'processing') && (
            <button
              type="button"
              className="btn btn-transcribe btn-sm"
              disabled
              id="transcribe-speech-btn"
            >
              <span className="spinner-inline" aria-hidden="true" />
              {transcriptionStatus === 'queued' ? 'Queued on Worker...' : 'Transcribing Speech...'}
            </button>
          )}

          {uploadStatus === 'success' && transcriptionStatus === 'completed' && (
            <button
              type="button"
              className="btn btn-success-subtle btn-sm"
              disabled
              id="transcribe-speech-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Transcript Generated
            </button>
          )}

          {uploadStatus === 'success' && transcriptionStatus === 'failed' && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleTranscribe}
              title="Retry transcribing this take"
              id="transcribe-speech-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Retry Transcription
            </button>
          )}
        </div>
      </div>

      {/* Upload Feedback Banners */}
      {uploadStatus === 'success' && uploadResult && (
        <div className="upload-banner upload-banner-success" role="status" id="upload-success-banner">
          <div className="upload-banner-icon" aria-hidden="true">✓</div>
          <div className="upload-banner-content">
            <div className="upload-banner-title">
              Take #{takeNumber} Persisted Locally (<code>{uploadResult.file_id}</code>)
            </div>
            <p className="upload-banner-text">
              Securely saved to private local backend storage ({uploadResult.mime_type} &bull; {Math.round(uploadResult.byte_size / 1024)} KB) under session <code>{uploadResult.session_id}</code>.
            </p>
            <div className="upload-banner-sub">
              No cloud leakage &bull; Excluded from Git &bull; Ready for speech recognition.
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="upload-banner upload-banner-error" role="alert" id="upload-error-banner">
          <div className="upload-banner-icon" aria-hidden="true">⚠</div>
          <div className="upload-banner-content">
            <div className="upload-banner-title">Upload Failed</div>
            <p className="upload-banner-text">{uploadError}</p>
            <div className="upload-banner-reassurance">
              Your recording is preserved in your browser. You can listen, scrub, download, or retry the upload.
            </div>
          </div>
        </div>
      )}

      {/* Transcription In-Progress Banner */}
      {(transcriptionStatus === 'queued' || transcriptionStatus === 'processing') && (
        <div className="transcribe-banner transcribe-banner-processing" role="status" id="transcription-processing-banner">
          <span className="spinner-inline" aria-hidden="true" style={{ marginTop: '0.15rem' }} />
          <div>
            <div className="upload-banner-title">
              {transcriptionStatus === 'queued' ? 'Speech Transcription Queued' : 'Recognising Speech Locally...'}
            </div>
            <p className="upload-banner-text">
              Offline whisper model (<code>base.en</code>) running on single bounded worker thread.
              Processing duration depends on audio length; no artificial progress percentages are displayed.
            </p>
          </div>
        </div>
      )}

      {/* Transcription Error Banner */}
      {transcriptionStatus === 'failed' && (
        <div className="transcribe-banner transcribe-banner-error" role="alert" id="transcription-error-banner">
          <div className="upload-banner-icon" aria-hidden="true">⚠</div>
          <div className="upload-banner-content">
            <div className="upload-banner-title">Transcription Failed</div>
            <p className="upload-banner-text">{transcriptionError}</p>
            <div className="upload-banner-reassurance">
              Your audio recording is intact. You can click &ldquo;Retry Transcription&rdquo; to re-queue.
            </div>
          </div>
        </div>
      )}

      {/* Completed Transcript View Card */}
      {transcriptionStatus === 'completed' && transcript && (
        <div className="transcript-card" id="transcript-display-card">
          <div className="transcript-card-header">
            <div className="transcript-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Recognised Speech Transcript
            </div>
            <div className="transcript-meta-pills">
              <span className="transcript-pill transcript-pill-highlight">
                model: {transcript.model_name} ({transcript.compute_type})
              </span>
              <span className="transcript-pill">
                latency: {transcript.processing_time_seconds.toFixed(2)}s
              </span>
              <span className="transcript-pill">
                words: {transcript.word_count}
              </span>
              <span className="transcript-pill">
                audio: {transcript.duration_seconds.toFixed(1)}s
              </span>
            </div>
          </div>

          <div className="transcript-text-container">
            <div className="transcript-text-label">Recognised Text (Offline Local Model)</div>
            <p className="transcript-recognised-text" id="recognised-transcript-text">
              {transcript.text}
            </p>
          </div>

          {transcript.segments && transcript.segments.length > 0 && (
            <div className="transcript-segments-section">
              <button
                type="button"
                className="transcript-segments-toggle"
                onClick={() => setShowSegments((prev) => !prev)}
                id="toggle-segments-btn"
                aria-expanded={showSegments}
              >
                <span>{showSegments ? '▲ Hide' : '▼ View'} Timestamped Segments ({transcript.segments.length})</span>
              </button>

              {showSegments && (
                <div className="transcript-segments-list" id="transcript-segments-list">
                  {transcript.segments.map((seg) => (
                    <div key={seg.id} className="transcript-segment-row">
                      <span className="transcript-segment-timestamp">
                        [{formatPlayerTime(seg.start)} - {formatPlayerTime(seg.end)}]
                      </span>
                      <span className="transcript-segment-content">{seg.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="transcript-disclaimer-callout">
            <span aria-hidden="true">ℹ️</span>
            <div>
              <strong>Academic Integrity Notice:</strong> Speech transcription is produced locally without remote APIs. It may contain speech-to-text recognition errors.
              Token probabilities are internal acoustic confidence metrics and must <em>not</em> be conflated with pronunciation or fluency scores.
            </div>
          </div>
        </div>
      )}

      {/* Scrubber and Playback Controls */}
      <div className="player-controls-row">
        <button
          type="button"
          className="btn btn-icon btn-play-pause"
          onClick={togglePlayPause}
          aria-label={isPlaying ? 'Pause audio playback' : 'Play recorded audio'}
          id="play-pause-btn"
        >
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        <div className="scrubber-wrapper">
          <input
            type="range"
            className="seek-slider"
            min={0}
            max={duration > 0 ? duration : 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Seek audio playback"
            id="audio-seek-slider"
          />
          <div className="time-stamps">
            <span>{formatPlayerTime(currentTime)}</span>
            <span>{formatPlayerTime(duration)}</span>
          </div>
        </div>
      </div>

      <div className="player-footer">
        <div className="pipeline-notice">
          <span className="info-icon" aria-hidden="true">💡</span>
          <span>
            <strong>Audio verified in browser.</strong> Click &ldquo;Upload Recording&rdquo; to persist locally for speech-to-text and acoustic analysis.
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleNextTake}
          id="record-new-take-btn"
        >
          Record Take #{takeNumber + 1}
        </button>
      </div>
    </div>
  )
}
