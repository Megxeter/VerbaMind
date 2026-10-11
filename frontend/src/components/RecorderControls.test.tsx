import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecorderControls } from './RecorderControls'

describe('RecorderControls Component', () => {
  it('renders start recording button when idle', () => {
    const onStart = vi.fn()
    render(
      <RecorderControls
        status="idle"
        elapsedSeconds={0}
        maxSeconds={180}
        onStart={onStart}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onStop={vi.fn()}
        onReset={vi.fn()}
      />
    )

    const startBtn = screen.getByRole('button', { name: /start recording/i })
    expect(startBtn).toBeInTheDocument()
    fireEvent.click(startBtn)
    expect(onStart).toHaveBeenCalled()
  })

  it('renders pause and stop buttons when recording', () => {
    const onPause = vi.fn()
    const onStop = vi.fn()
    render(
      <RecorderControls
        status="recording"
        elapsedSeconds={25}
        maxSeconds={180}
        onStart={vi.fn()}
        onPause={onPause}
        onResume={vi.fn()}
        onStop={onStop}
        onReset={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stop & review/i })).toBeInTheDocument()
    expect(screen.getByText('00:25')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(onPause).toHaveBeenCalled()
  })

  it('renders record another take button when stopped', () => {
    const onReset = vi.fn()
    render(
      <RecorderControls
        status="stopped"
        elapsedSeconds={42}
        maxSeconds={180}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onStop={vi.fn()}
        onReset={onReset}
      />
    )

    const reRecordBtn = screen.getByRole('button', { name: /record another take/i })
    expect(reRecordBtn).toBeInTheDocument()
    fireEvent.click(reRecordBtn)
    expect(onReset).toHaveBeenCalled()
  })

  it('renders retry button when status is error', () => {
    const onStart = vi.fn()
    render(
      <RecorderControls
        status="error"
        elapsedSeconds={0}
        maxSeconds={180}
        onStart={onStart}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onStop={vi.fn()}
        onReset={vi.fn()}
      />
    )

    const retryBtn = screen.getByRole('button', { name: /retry microphone/i })
    expect(retryBtn).toBeInTheDocument()
    fireEvent.click(retryBtn)
    expect(onStart).toHaveBeenCalled()
  })
})
