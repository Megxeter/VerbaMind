import React from 'react'

export const Header: React.FC = () => {
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
          <span className="badge badge-subtle">
            <span className="status-dot status-dot-success"></span>
            Milestone 1: Audio Engine Verified
          </span>
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
