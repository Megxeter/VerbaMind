import React, { useEffect, useRef, useState } from 'react'
import { useAcoustics } from '../hooks/useAcoustics'
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

function formatTimestampPrecise(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00'
  const totalHundredths = Math.round(seconds * 100)
  const mins = Math.floor(totalHundredths / 6000)
  const remainingHundredths = totalHundredths % 6000
  const secs = Math.floor(remainingHundredths / 100)
  const hundredths = remainingHundredths % 100
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`
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
  const [showGaps, setShowGaps] = useState(false)

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

  const {
    status: acousticsStatus,
    error: acousticsError,
    measurements: acousticMeasurements,
    analyzeRecording: runAcousticAnalysis,
    resetAcoustics,
  } = useAcoustics()

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

  // Reset upload, transcription, and acoustics status when audio URL changes (new take recorded)
  useEffect(() => {
    resetUpload()
    resetTranscription()
    resetAcoustics()
    setShowSegments(false)
    setShowGaps(false)
  }, [audioUrl, resetUpload, resetTranscription, resetAcoustics])

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

  const handleAnalyzeAcoustics = async () => {
    await runAcousticAnalysis(sessionId, takeNumber)
  }

  const handlePlayGap = (startSeconds: number) => {
    const audio = audioRef.current
    if (!audio) return

    // Seek to 0.75s before gap start, bounded at 0 to hear surrounding context
    const targetSeek = Math.max(0, startSeconds - 0.75)
    audio.currentTime = targetSeek
    setCurrentTime(targetSeek)

    // Reuse existing player, avoiding overlapping playback
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.warn('Audio play error:', err))
  }

  const handlePlayTimestamp = (startSeconds: number) => {
    const audio = audioRef.current
    if (!audio) return

    // Seek shortly before the word/segment timestamp (approx 250ms lead-in, bounded at 0)
    const targetSeek = Math.max(0, startSeconds - 0.25)
    audio.currentTime = targetSeek
    setCurrentTime(targetSeek)

    // Reuse existing player, preventing overlapping playback
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.warn('Audio play error:', err))
  }

  const handleNextTake = () => {
    resetUpload()
    resetTranscription()
    resetAcoustics()
    setShowSegments(false)
    setShowGaps(false)
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

          {/* Acoustic Analysis Action States */}
          {uploadStatus === 'success' && acousticsStatus === 'idle' && (
            <button
              type="button"
              className="btn btn-acoustics btn-sm"
              onClick={handleAnalyzeAcoustics}
              title="Measure speech delivery rhythm, active duration, and pauses"
              id="analyze-acoustics-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20v-6M6 20V10M18 20V4" />
              </svg>
              Analyze Delivery
            </button>
          )}

          {uploadStatus === 'success' && acousticsStatus === 'analyzing' && (
            <button
              type="button"
              className="btn btn-acoustics btn-sm"
              disabled
              id="analyze-acoustics-btn"
            >
              <span className="spinner-inline" aria-hidden="true" />
              Analyzing Delivery...
            </button>
          )}

          {uploadStatus === 'success' && acousticsStatus === 'completed' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAnalyzeAcoustics}
              title="Refresh delivery measurements"
              id="analyze-acoustics-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Re-analyze Delivery
            </button>
          )}

          {uploadStatus === 'success' && acousticsStatus === 'failed' && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleAnalyzeAcoustics}
              title="Retry delivery analysis"
              id="analyze-acoustics-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Retry Delivery Analysis
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

      {/* Acoustic Analysis In-Progress Banner */}
      {acousticsStatus === 'analyzing' && (
        <div className="transcribe-banner transcribe-banner-processing" role="status" id="acoustics-processing-banner">
          <span className="spinner-inline" aria-hidden="true" style={{ marginTop: '0.15rem' }} />
          <div>
            <div className="upload-banner-title">Analyzing Speech Delivery Rhythm...</div>
            <p className="upload-banner-text">
              Measuring voice activity, pause durations, and speech activity ratio locally via energy RMS analysis.
            </p>
          </div>
        </div>
      )}

      {/* Acoustic Analysis Error Banner */}
      {acousticsStatus === 'failed' && (
        <div className="transcribe-banner transcribe-banner-error" role="alert" id="acoustics-error-banner">
          <div className="upload-banner-icon" aria-hidden="true">⚠</div>
          <div className="upload-banner-content">
            <div className="upload-banner-title">Acoustic Analysis Failed</div>
            <p className="upload-banner-text">{acousticsError}</p>
            <div className="upload-banner-reassurance">
              Your audio recording is intact. You can click &ldquo;Retry Delivery Analysis&rdquo; to re-run.
            </div>
          </div>
        </div>
      )}

      {/* Audio Delivery Measurements Panel */}
      {acousticsStatus === 'completed' && acousticMeasurements && (
        <div className="acoustics-card" id="acoustics-display-card">
          <div className="acoustics-card-header">
            <div className="acoustics-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20v-6M6 20V10M18 20V4" />
              </svg>
              Audio Delivery Measurements
            </div>
            <div className="acoustics-meta-pills">
              <span className="transcript-pill transcript-pill-highlight">
                Estimate &bull; Energy RMS VAD
              </span>
              <span className="transcript-pill">
                Threshold: -40 dBFS
              </span>
              <span className="transcript-pill">
                Min Pause: 250ms
              </span>
            </div>
          </div>

          <div className="acoustics-callout-info">
            <strong>Detector Assumptions:</strong> Energy-based RMS frame analysis (25ms window, 10ms hop) with calibrated -40 dBFS threshold and 150ms hangover window.
            Values are physical timing estimates and do <em>not</em> represent fluency or pronunciation scores.
          </div>

          {/* Metric Stat Grid */}
          <div className="acoustics-grid">
            <div className="acoustics-metric-card">
              <div className="metric-label">Recording Duration</div>
              <div className="metric-value">{acousticMeasurements.total_duration_seconds.toFixed(1)}s</div>
              <div className="metric-sub">Total media length</div>
            </div>

            <div className="acoustics-metric-card">
              <div className="metric-label">Speech-Active Duration</div>
              <div className="metric-value">{acousticMeasurements.detected_speech_duration_seconds.toFixed(1)}s</div>
              <div className="metric-sub">Estimated voice activity</div>
            </div>

            <div className="acoustics-metric-card">
              <div className="metric-label">Speech-Activity Percentage</div>
              <div className="metric-value">
                {(acousticMeasurements.speech_activity_percentage ?? (acousticMeasurements.speech_activity_ratio * 100)).toFixed(1)}%
              </div>
              <div className="metric-sub">Active voice vs total time</div>
            </div>

            <div className="acoustics-metric-card">
              <div className="metric-label">Leading Silence</div>
              <div className="metric-value">{acousticMeasurements.leading_silence_seconds.toFixed(2)}s</div>
              <div className="metric-sub">Delay before first speech</div>
            </div>

            <div className="acoustics-metric-card">
              <div className="metric-label">Trailing Silence</div>
              <div className="metric-value">{acousticMeasurements.trailing_silence_seconds.toFixed(2)}s</div>
              <div className="metric-sub">Delay after final speech</div>
            </div>

            <div className="acoustics-metric-card">
              <div className="metric-label">Estimated Speaking Pace</div>
              {acousticMeasurements.words_per_minute_total !== null ? (
                <>
                  <div className="metric-value">{Math.round(acousticMeasurements.words_per_minute_total)} WPM</div>
                  <div className="metric-sub">
                    {acousticMeasurements.words_per_minute_speech_only ? `${Math.round(acousticMeasurements.words_per_minute_speech_only)} WPM articulation rate` : ''}
                    <br />
                    <em>ASR transcript-derived</em>
                  </div>
                </>
              ) : (
                <>
                  <div className="metric-value metric-value-empty">—</div>
                  <div className="metric-sub">
                    Requires recognized transcript. Click &ldquo;Transcribe Speech&rdquo; above.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Silence Notice if no voice activity detected */}
          {acousticMeasurements.detected_speech_duration_seconds === 0 && (
            <div className="acoustics-silence-warning" role="status">
              ℹ No voice activity detected above the -40 dBFS energy threshold. Audio appears to be silent or low-volume.
            </div>
          )}

          {/* Internal Non-Speech Gaps Section */}
          <div className="acoustics-gaps-section">
            <div className="acoustics-gaps-header">
              <strong>Internal Non-Speech Gaps (&ge; 250ms):</strong> {acousticMeasurements.internal_gap_count} gaps
              {acousticMeasurements.internal_gap_count > 0 && (
                <span> (total {acousticMeasurements.total_internal_gap_duration_seconds.toFixed(2)}s, mean {acousticMeasurements.mean_internal_gap_duration_seconds.toFixed(2)}s)</span>
              )}
            </div>

            <div className="acoustics-gap-pedagogy-note">
              <strong>Measurement Notice:</strong> Internal gaps are physical non-speech intervals (&ge; 250 ms). In natural spoken delivery, pauses serve essential acoustic and cognitive functions (breathing, phrasing, emphasis, and planning); they are <em>not</em> automatically hesitations or mistakes.
            </div>

            {acousticMeasurements.internal_gap_count > 0 ? (
              <>
                <button
                  type="button"
                  className="transcript-segments-toggle"
                  onClick={() => setShowGaps((prev) => !prev)}
                  id="toggle-gaps-btn"
                  aria-expanded={showGaps}
                >
                  <span>{showGaps ? '▲ Hide' : '▼ View'} Internal Gaps Breakdown ({acousticMeasurements.internal_gap_count})</span>
                </button>

                {showGaps && (
                  <div className="acoustics-gaps-list" id="acoustics-gaps-list">
                    {acousticMeasurements.internal_gaps.map((gap, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="acoustics-gap-row acoustics-gap-btn"
                        onClick={() => handlePlayGap(gap.start_seconds)}
                        aria-label={`Play audio around Gap #${idx + 1}, interval ${formatTimestampPrecise(gap.start_seconds)} to ${formatTimestampPrecise(gap.end_seconds)}, duration ${gap.duration_seconds.toFixed(2)} seconds`}
                        title={`Click to seek audio to ${formatTimestampPrecise(Math.max(0, gap.start_seconds - 0.75))} and listen to Gap #${idx + 1} with surrounding speech`}
                        id={`gap-play-btn-${idx + 1}`}
                      >
                        <span className="gap-play-icon" aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </span>
                        <span className="gap-badge">Gap #{idx + 1}</span>
                        <span className="gap-timestamp">
                          [{formatTimestampPrecise(gap.start_seconds)} &ndash; {formatTimestampPrecise(gap.end_seconds)}]
                        </span>
                        <span className="gap-duration">{gap.duration_seconds.toFixed(2)}s duration</span>
                        <span className="gap-listen-cue" aria-hidden="true">Listen &rarr;</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="acoustics-empty-gaps">
                No internal non-speech pauses &ge; 250 ms detected.
              </div>
            )}
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
            <div className="transcript-text-header-row">
              <div className="transcript-text-label">Recognised Text (Offline Local Model)</div>
              <span
                className="transcript-alignment-badge"
                title="Word/segment timestamps are approximate cross-attention alignments; not phoneme-level precision."
              >
                Approximate Alignment
              </span>
            </div>

            {transcript.segments && transcript.segments.length > 0 ? (
              <div className="transcript-interactive-flow" id="recognised-transcript-text" role="region" aria-label="Interactive transcript text">
                {transcript.segments.map((seg) => {
                  const hasWords = seg.words && seg.words.length > 0
                  const isSegActive = currentTime >= seg.start && currentTime <= seg.end

                  if (hasWords && seg.words) {
                    return (
                      <span key={seg.id} className="transcript-segment-inline">
                        {seg.words.map((w, wIdx) => {
                          const isWordActive = currentTime >= w.start && currentTime <= w.end
                          return (
                            <React.Fragment key={wIdx}>
                              <button
                                type="button"
                                className={`transcript-word-btn ${isWordActive ? 'transcript-word-active' : ''}`}
                                onClick={() => handlePlayTimestamp(w.start)}
                                aria-label={`Play audio at word "${w.word.trim()}" (approx ${formatTimestampPrecise(w.start)})`}
                                title={`Click to play audio from ${formatTimestampPrecise(Math.max(0, w.start - 0.25))}`}
                              >
                                {w.word}
                              </button>
                              {' '}
                            </React.Fragment>
                          )
                        })}
                      </span>
                    )
                  }

                  // Fallback to segment-level clickable phrase if word timings are unavailable
                  return (
                    <React.Fragment key={seg.id}>
                      <button
                        type="button"
                        className={`transcript-segment-inline-btn ${isSegActive ? 'transcript-segment-active' : ''}`}
                        onClick={() => handlePlayTimestamp(seg.start)}
                        aria-label={`Play audio for segment "${seg.text.trim()}" (approx ${formatTimestampPrecise(seg.start)})`}
                        title={`Click to play audio from ${formatTimestampPrecise(Math.max(0, seg.start - 0.25))}`}
                      >
                        {seg.text}
                      </button>
                      {' '}
                    </React.Fragment>
                  )
                })}
              </div>
            ) : (
              <p className="transcript-recognised-text" id="recognised-transcript-text">
                {transcript.text}
              </p>
            )}
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
                  {transcript.segments.map((seg) => {
                    const isSegActive = currentTime >= seg.start && currentTime <= seg.end
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        className={`transcript-segment-row transcript-segment-btn ${isSegActive ? 'transcript-segment-active' : ''}`}
                        onClick={() => handlePlayTimestamp(seg.start)}
                        aria-label={`Play segment from ${formatPlayerTime(seg.start)}: ${seg.text.trim()}`}
                        title={`Click to seek audio to ${formatPlayerTime(Math.max(0, seg.start - 0.25))} and play segment`}
                        id={`segment-btn-${seg.id}`}
                      >
                        <span className="segment-play-icon" aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </span>
                        <span className="transcript-segment-timestamp">
                          [{formatPlayerTime(seg.start)} - {formatPlayerTime(seg.end)}]
                        </span>
                        <span className="transcript-segment-content">{seg.text}</span>
                        <span className="segment-listen-cue" aria-hidden="true">Play &rarr;</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="transcript-disclaimer-callout">
            <span aria-hidden="true">ℹ️</span>
            <div>
              <strong>Academic Integrity Notice:</strong> Speech transcription is produced locally without remote APIs.
              Word and segment timestamps are approximate cross-attention alignments and do <em>not</em> claim phoneme-level ground truth.
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
