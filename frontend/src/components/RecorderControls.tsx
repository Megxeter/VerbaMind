import React from 'react'
import type { RecorderState } from '../types/exercise'

interface RecorderControlsProps {
  status: RecorderState
  elapsedSeconds: number
  maxSeconds: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onReset: () => void
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export const RecorderControls: React.FC<RecorderControlsProps> = ({
  status,
  elapsedSeconds,
  maxSeconds,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
}) => {
  const isRecording = status === 'recording'
  const isPaused = status === 'paused'
  const isStopped = status === 'stopped'
  const progressPercent = Math.min(100, (elapsedSeconds / maxSeconds) * 100)
  const isNearLimit = elapsedSeconds >= maxSeconds - 20 // Warning in last 20s

  return (
    <div className="recorder-controls-card">
      <div className="timer-wrapper">
        <div className="timer-display" aria-live="polite">
          <span className={`timer-digits ${isNearLimit ? 'timer-warning' : ''}`}>
            {formatTime(elapsedSeconds)}
          </span>
          <span className="timer-cap"> / {formatTime(maxSeconds)}</span>
        </div>

        {(isRecording || isPaused) && (
          <div className="progress-bar-bg" title={`${elapsedSeconds}s of ${maxSeconds}s recorded`}>
            <div
              className={`progress-bar-fill ${isNearLimit ? 'progress-warning' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      <div className="controls-button-group">
        {/* State: Not yet recording */}
        {(status === 'idle' || status === 'ready' || status === 'requesting-permission') && (
          <button
            type="button"
            className="btn btn-primary btn-record"
            onClick={onStart}
            disabled={status === 'requesting-permission'}
            id="start-record-btn"
          >
            <span className="record-dot" aria-hidden="true" />
            Start Recording
          </button>
        )}

        {/* State: Error / Permission Denied */}
        {status === 'error' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStart}
            id="retry-record-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            Retry Microphone
          </button>
        )}

        {/* State: Actively Recording */}
        {isRecording && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onPause}
              id="pause-record-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Pause
            </button>

            <button
              type="button"
              className="btn btn-danger"
              onClick={onStop}
              id="stop-record-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
              Stop & Review
            </button>
          </>
        )}

        {/* State: Paused */}
        {isPaused && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onResume}
              id="resume-record-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Resume
            </button>

            <button
              type="button"
              className="btn btn-danger"
              onClick={onStop}
              id="stop-paused-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
              Stop & Review
            </button>
          </>
        )}

        {/* State: Finished Take */}
        {isStopped && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onReset}
            id="re-record-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Record Another Take
          </button>
        )}
      </div>
    </div>
  )
}
