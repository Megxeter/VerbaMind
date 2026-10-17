import React, { useMemo } from 'react'
import type { StoredAttempt } from '../types/comparison'
import { computeAttemptComparison } from '../utils/comparison'

export interface AttemptComparisonProps {
  baselineAttempt: StoredAttempt
  currentAttempt: StoredAttempt
  activeAudioTrack: 'current' | 'baseline'
  onSelectAudioTrack: (track: 'current' | 'baseline') => void
  onReplaceBaseline: () => void
  onClearBaseline: () => void
}

export const AttemptComparison: React.FC<AttemptComparisonProps> = ({
  baselineAttempt,
  currentAttempt,
  activeAudioTrack,
  onSelectAudioTrack,
  onReplaceBaseline,
  onClearBaseline,
}) => {
  const comparison = useMemo(() => {
    return computeAttemptComparison(baselineAttempt, currentAttempt)
  }, [baselineAttempt, currentAttempt])

  if (!comparison) {
    return null
  }

  const { metrics, compatibility } = comparison

  const metricRows = [
    metrics.recordingDuration,
    metrics.speechActiveDuration,
    metrics.speechActivityPercentage,
    metrics.internalGapCount,
    metrics.totalGapDuration,
    metrics.meanGapDuration,
    metrics.wpmTotal,
    metrics.wpmSpeechOnly,
  ]

  return (
    <div className="attempt-comparison-card" id="attempt-comparison-panel">
      <div className="comparison-header">
        <div>
          <div className="comparison-badge-group">
            <span className="badge badge-accent">Session-Only Comparison</span>
            <span className="badge badge-subtle">
              Take #{baselineAttempt.takeNumber} vs Take #{currentAttempt.takeNumber}
            </span>
          </div>
          <h3 className="comparison-title">Same-Exercise Attempt Comparison</h3>
          <p className="comparison-subtitle">
            Side-by-side acoustic delivery comparison for <em>{comparison.exerciseTitle}</em>.
          </p>
        </div>

        <div className="comparison-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onReplaceBaseline}
            title="Promote the current take to be your comparison baseline"
            id="update-baseline-btn"
          >
            Update Baseline to Take #{currentAttempt.takeNumber}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClearBaseline}
            title="Discard comparison baseline and release memory"
            id="clear-baseline-btn"
          >
            Clear Baseline
          </button>
        </div>
      </div>

      {/* Compatibility Status & Warnings */}
      {compatibility.warnings.length > 0 ? (
        <div className="comparison-warning-banner" role="alert">
          <div className="warning-icon" aria-hidden="true">⚠️</div>
          <div className="warning-content">
            <strong>Configuration Divergence Detected</strong>
            <ul className="warning-list">
              {compatibility.warnings.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="comparison-compatible-banner">
          <span className="compatible-icon" aria-hidden="true">✓</span>
          <span>
            <strong>Compatible Comparison</strong>: Identical exercise and acoustic detector parameters.
          </span>
        </div>
      )}

      {/* Active Audio Player Switcher (Single Player Requirement) */}
      <div className="comparison-player-switcher">
        <div className="switcher-label">
          <strong>Active Audio Player Track</strong>:
          <span className="switcher-caption">
            Both takes play through the same player below to prevent overlapping audio.
          </span>
        </div>
        <div className="switcher-buttons">
          <button
            type="button"
            className={`btn btn-sm ${activeAudioTrack === 'baseline' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onSelectAudioTrack('baseline')}
            id="listen-baseline-btn"
          >
            {activeAudioTrack === 'baseline' ? '▶ Playing: ' : ''}Listen to Take #{baselineAttempt.takeNumber} (Baseline)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeAudioTrack === 'current' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onSelectAudioTrack('current')}
            id="listen-current-btn"
          >
            {activeAudioTrack === 'current' ? '▶ Playing: ' : ''}Listen to Take #{currentAttempt.takeNumber} (Current Take)
          </button>
        </div>
      </div>

      {/* Comparison Metrics Table */}
      <div className="comparison-table-wrapper">
        <table className="comparison-table" aria-label="Acoustic Delivery Attempt Comparison">
          <thead>
            <tr>
              <th scope="col" className="col-metric">Delivery Measurement</th>
              <th scope="col" className="col-val">Take #{baselineAttempt.takeNumber} (Baseline)</th>
              <th scope="col" className="col-val">Take #{currentAttempt.takeNumber} (Current)</th>
              <th scope="col" className="col-diff">Difference (Δ)</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map((item) => (
              <tr key={item.key}>
                <td className="col-metric">
                  <div className="metric-name">{item.label}</div>
                  {item.notes && <div className="metric-note">{item.notes}</div>}
                </td>
                <td className="col-val numeric-cell">{item.formattedBaseline}</td>
                <td className="col-val numeric-cell">{item.formattedCurrent}</td>
                <td className="col-diff numeric-cell">
                  <span className="diff-chip">{item.formattedDifference}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scientific & Academic Integrity Notice */}
      <div className="comparison-notice-card">
        <div className="notice-icon" aria-hidden="true">💡</div>
        <div className="notice-text">
          <p>
            <strong>Measurement vs. Assessment</strong>: Higher speech activity, faster pacing, or fewer pauses do not automatically equate to better communication. Pauses serve natural physiological and cognitive functions (breathing, structural transitions, emphasis). VERBAMIND delivers objective physical delivery metrics; it does not assign speculative fluency grades.
          </p>
          <p className="notice-subtext">
            <strong>Session-Only Memory</strong>: Retained in browser memory for the current session. Clears on page reload. Durable cross-session candidate history remains future work.
          </p>
        </div>
      </div>
    </div>
  )
}
