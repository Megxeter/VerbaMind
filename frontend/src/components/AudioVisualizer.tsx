import React from 'react'

interface AudioVisualizerProps {
  isRecording: boolean
  isPaused: boolean
  audioLevel: number // 0 to 100
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording,
  isPaused,
  audioLevel,
}) => {
  // Generate 16 responsive bars with dynamic heights
  const bars = Array.from({ length: 16 }, (_, i) => {
    if (!isRecording || isPaused) {
      return 12 // Idle bar height in percentage
    }
    // Give each bar slight variation based on index and real audioLevel
    const phase = Math.sin((i / 16) * Math.PI)
    const dynamicHeight = Math.max(12, Math.min(100, audioLevel * (0.5 + phase * 0.8)))
    return Math.round(dynamicHeight)
  })

  return (
    <div className={`audio-visualizer ${isRecording ? 'visualizer-active' : ''} ${isPaused ? 'visualizer-paused' : ''}`}>
      <div className="visualizer-header">
        <div className="recording-status-indicator">
          {isRecording && !isPaused && (
            <>
              <span className="live-pulse-dot" aria-hidden="true" />
              <span className="live-status-text">Recording Live Audio</span>
            </>
          )}
          {isRecording && isPaused && (
            <>
              <span className="paused-dot" aria-hidden="true" />
              <span className="live-status-text">Recording Paused</span>
            </>
          )}
          {!isRecording && (
            <>
              <span className="idle-dot" aria-hidden="true" />
              <span className="live-status-text">Microphone Ready</span>
            </>
          )}
        </div>

        <div className="audio-meter-label">
          Input Level: <span className="meter-value">{audioLevel}%</span>
        </div>
      </div>

      <div className="waveform-bars" aria-label="Live audio input waveform visualizer">
        {bars.map((heightPercent, idx) => (
          <div
            key={idx}
            className="waveform-bar"
            style={{
              height: `${heightPercent}%`,
              transition: isRecording && !isPaused ? 'height 80ms ease' : 'height 300ms ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}
