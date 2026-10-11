import React from 'react'
import type { MicError } from '../types/exercise'

interface MicPermissionNoticeProps {
  error: MicError | null
  onRequestPermission: () => void
  isRequesting: boolean
}

export const MicPermissionNotice: React.FC<MicPermissionNoticeProps> = ({
  error,
  onRequestPermission,
  isRequesting,
}) => {
  if (!error) return null

  const isDenied = error.code === 'PERMISSION_DENIED'

  return (
    <div className={`notice-card notice-card-${error.code.toLowerCase()}`} role="alert">
      <div className="notice-icon">
        {isDenied ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>

      <div className="notice-content">
        <h4 className="notice-title">{error.message}</h4>
        <p className="notice-remediation">{error.remediation}</p>

        {isDenied && (
          <div className="notice-steps">
            <strong>How to enable:</strong>
            <ol>
              <li>Look for the lock icon 🔒 or camera/mic icon on the left side of your browser address bar.</li>
              <li>Click it and change <strong>Microphone</strong> from <em>Block</em> to <em>Allow</em>.</li>
              <li>Click the retry button below or refresh the page.</li>
            </ol>
          </div>
        )}

        <div className="notice-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRequestPermission}
            disabled={isRequesting}
          >
            {isRequesting ? 'Requesting Access...' : 'Retry Microphone Permission'}
          </button>
        </div>
      </div>
    </div>
  )
}
