import React, { useEffect, useRef, useState } from 'react'

interface AudioPlayerProps {
  audioUrl: string
  audioBlob: Blob | null
  mimeType: string | null
  exerciseTitle: string
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
  takeNumber,
  onRecordAnotherTake,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

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
          Download Audio
        </button>
      </div>

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
            <strong>Audio successfully verified in browser.</strong> In Phase 2, this recording will be sent to the FastAPI Speech-to-Text worker for word-level acoustic analysis.
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onRecordAnotherTake}
          id="record-new-take-btn"
        >
          Record Take #{takeNumber + 1}
        </button>
      </div>
    </div>
  )
}
