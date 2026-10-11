import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AudioPlayer } from './AudioPlayer'

describe('AudioPlayer Component', () => {
  const fakeBlob = new Blob(['mock audio data'], { type: 'audio/webm' })
  const fakeUrl = 'blob:http://localhost:5173/mock-audio-uuid'

  it('renders audio playback card with take information', () => {
    const onRecordAnother = vi.fn()
    render(
      <AudioPlayer
        audioUrl={fakeUrl}
        audioBlob={fakeBlob}
        mimeType="audio/webm"
        exerciseTitle="Self-Introduction for Technical Campus Placement"
        takeNumber={1}
        onRecordAnotherTake={onRecordAnother}
      />
    )

    expect(screen.getByText('Take #1 Captured')).toBeInTheDocument()
    expect(screen.getByText('Self-Introduction for Technical Campus Placement')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play recorded audio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download audio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /record take #2/i })).toBeInTheDocument()
  })

  it('triggers onRecordAnotherTake when retake button clicked', () => {
    const onRecordAnother = vi.fn()
    render(
      <AudioPlayer
        audioUrl={fakeUrl}
        audioBlob={fakeBlob}
        mimeType="audio/webm"
        exerciseTitle="Test Exercise"
        takeNumber={2}
        onRecordAnotherTake={onRecordAnother}
      />
    )

    const retakeBtn = screen.getByRole('button', { name: /record take #3/i })
    fireEvent.click(retakeBtn)
    expect(onRecordAnother).toHaveBeenCalled()
  })
})
