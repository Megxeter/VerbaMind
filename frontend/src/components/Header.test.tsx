import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Header } from './Header'

describe('Header Component Backend Connectivity Status', () => {
  it('displays API Online badge when backend is connected', () => {
    render(
      <Header
        customHealthInfo={{
          status: 'online',
          version: '0.1.0',
          error: null,
          checkedAt: new Date(),
        }}
      />
    )

    expect(screen.getByText('API Online (v0.1.0)')).toBeInTheDocument()
    expect(screen.getByText('VERBAMIND')).toBeInTheDocument()
  })

  it('displays API Offline badge when backend is unreachable', () => {
    render(
      <Header
        customHealthInfo={{
          status: 'offline',
          version: null,
          error: 'Service unreachable',
          checkedAt: new Date(),
        }}
      />
    )

    expect(screen.getByText('API Offline')).toBeInTheDocument()
  })

  it('displays API Connecting badge when checking status', () => {
    render(
      <Header
        customHealthInfo={{
          status: 'checking',
          version: null,
          error: null,
          checkedAt: null,
        }}
      />
    )

    expect(screen.getByText('API Connecting...')).toBeInTheDocument()
  })
})
