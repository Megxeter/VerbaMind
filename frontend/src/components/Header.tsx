import React from 'react'
import { useBackendStatus } from '../hooks/useBackendStatus'
import type { BackendHealthInfo } from '../hooks/useBackendStatus'

interface HeaderProps {
  customHealthInfo?: BackendHealthInfo
}

export const Header: React.FC<HeaderProps> = ({ customHealthInfo }) => {
  const { healthInfo: hookHealthInfo } = useBackendStatus()
  const health = customHealthInfo || hookHealthInfo

  return (
    <header className="site-header">
      <div className="header-inner container">
        <div className="brand-group">
          <div className="brand-logo" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
              <line x1="8" x2="16" y1="22" y2="22" />
            </svg>
          </div>
          <div>
            <div className="brand-title-row">
              <h1 className="brand-title">VERBAMIND</h1>
              <span className="badge badge-accent">B.Tech AI/ML Project</span>
            </div>
            <p className="brand-tagline">Online English Speaking & Placement Communication Coaching</p>
          </div>
        </div>

        <div className="header-meta">
          {/* Accessible Backend Connection Status */}
          <div className="backend-status-wrapper" role="status" aria-live="polite">
            {health.status === 'online' && (
              <span
                className="badge badge-success"
                title={`FastAPI backend connected at http://127.0.0.1:8000/api/health (${health.version})`}
                id="backend-status-online"
              >
                <span className="status-dot status-dot-success" aria-hidden="true"></span>
                API Online (v{health.version || '0.1.0'})
              </span>
            )}
            {health.status === 'offline' && (
              <span
                className="badge badge-warning"
                title="FastAPI backend is unreachable at http://127.0.0.1:8000. Start backend with: uv run uvicorn backend.main:app"
                id="backend-status-offline"
              >
                <span className="status-dot status-dot-warning" aria-hidden="true"></span>
                API Offline
              </span>
            )}
            {health.status === 'checking' && (
              <span
                className="badge badge-subtle"
                title="Checking backend liveness..."
                id="backend-status-checking"
              >
                <span className="status-dot status-dot-checking" aria-hidden="true"></span>
                API Connecting...
              </span>
            )}
          </div>

          <span className="privacy-pill" title="Recordings are kept privately on your client device">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Private & Client-Scoped
          </span>
        </div>
      </div>
    </header>
  )
}
