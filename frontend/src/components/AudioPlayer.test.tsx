import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioPlayer } from './AudioPlayer'

describe('AudioPlayer Component', () => {
  const fakeBlob = new Blob(['mock audio data'], { type: 'audio/webm' })
  const fakeUrl = 'blob:http://localhost:5173/mock-audio-uuid'
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders audio playback card with take information and actions', () => {
    const onRecordAnother = vi.fn()
    render(
      <AudioPlayer
        audioUrl={fakeUrl}
        audioBlob={fakeBlob}
        mimeType="audio/webm"
        exerciseTitle="Self-Introduction for Technical Campus Placement"
        exerciseId="self-intro"
        sessionId="sess_test_1"
        takeNumber={1}
        onRecordAnotherTake={onRecordAnother}
      />
    )

    expect(screen.getByText('Take #1 Captured')).toBeInTheDocument()
    expect(screen.getByText('Self-Introduction for Technical Campus Placement')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play recorded audio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload recording/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /record take #2/i })).toBeInTheDocument()
  })

  it('handles successful upload workflow and displays success feedback', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        session_id: 'sess_test_1',
        exercise_id: 'self-intro',
        take_number: 1,
        file_id: 'take_1.webm',
        byte_size: 15360,
        mime_type: 'audio/webm',
        created_at: '2026-10-12T12:00:00Z',
        status: 'uploaded',
      }),
    })

    const onRecordAnother = vi.fn()
    render(
      <AudioPlayer
        audioUrl={fakeUrl}
        audioBlob={fakeBlob}
        mimeType="audio/webm"
        exerciseTitle="Self-Introduction"
        exerciseId="self-intro"
        sessionId="sess_test_1"
        takeNumber={1}
        onRecordAnotherTake={onRecordAnother}
      />
    )

    const uploadBtn = screen.getByRole('button', { name: /upload recording/i })
    fireEvent.click(uploadBtn)

    await waitFor(() => {
      expect(screen.getByText(/take #1 persisted locally/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /take #1 uploaded/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /transcribe speech/i })).toBeInTheDocument()
  })

  it('displays error banner on upload failure while preserving playback controls', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({
        error: {
          code: 'TAKE_ALREADY_EXISTS',
          message: 'Take 1 already exists for this session.',
        },
      }),
    })

    const onRecordAnother = vi.fn()
    render(
      <AudioPlayer
        audioUrl={fakeUrl}
        audioBlob={fakeBlob}
        mimeType="audio/webm"
        exerciseTitle="Self-Introduction"
        exerciseId="self-intro"
        sessionId="sess_test_1"
        takeNumber={1}
        onRecordAnotherTake={onRecordAnother}
      />
    )

    const uploadBtn = screen.getByRole('button', { name: /upload recording/i })
    fireEvent.click(uploadBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/take 1 already exists for this session/i)).toBeInTheDocument()
    })

    // Local playback and scrubber remain intact
    expect(screen.getByRole('button', { name: /play recorded audio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument()
    // Retry button is available
    expect(screen.getByRole('button', { name: /retry upload/i })).toBeInTheDocument()
  })

  it('triggers onRecordAnotherTake when retake button clicked', () => {
    const onRecordAnother = vi.fn()
    render(
      <AudioPlayer
        audioUrl={fakeUrl}
        audioBlob={fakeBlob}
        mimeType="audio/webm"
        exerciseTitle="Test Exercise"
        exerciseId="test-ex"
        sessionId="sess_test_1"
        takeNumber={2}
        onRecordAnotherTake={onRecordAnother}
      />
    )

    const retakeBtn = screen.getByRole('button', { name: /record take #3/i })
    fireEvent.click(retakeBtn)
    expect(onRecordAnother).toHaveBeenCalled()
  })

  it('handles full upload and transcription flow with safe text display and disclaimers', async () => {
    const mockTranscript = {
      text: 'Distributed caching enhances scalability and reduces latency.',
      segments: [
        {
          id: 1,
          start: 0.0,
          end: 3.2,
          text: 'Distributed caching enhances scalability and reduces latency.',
          words: [],
        },
      ],
      language: 'en',
      language_probability: 1.0,
      duration_seconds: 3.2,
      processing_time_seconds: 0.35,
      model_name: 'base.en',
      device: 'cpu',
      compute_type: 'int8',
      word_count: 7,
    }

    const fetchSpy = vi.fn()
    // First call: Upload POST -> 201
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        session_id: 'sess_test_1',
        exercise_id: 'tech-caching',
        take_number: 1,
        file_id: 'take_1.webm',
        byte_size: 12000,
        mime_type: 'audio/webm',
        created_at: '2026-10-12T12:00:00Z',
        status: 'uploaded',
      }),
    })
    // Second call: Transcribe POST -> 200 completed immediately
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        job_id: 'job_123',
        session_id: 'sess_test_1',
        take_number: 1,
        status: 'completed',
        transcript: mockTranscript,
      }),
    })

    globalThis.fetch = fetchSpy

    const onRecordAnother = vi.fn()
    render(
      <AudioPlayer
        audioUrl={fakeUrl}
        audioBlob={fakeBlob}
        mimeType="audio/webm"
        exerciseTitle="Distributed Caching"
        exerciseId="tech-caching"
        sessionId="sess_test_1"
        takeNumber={1}
        onRecordAnotherTake={onRecordAnother}
      />
    )

    // Upload first
    fireEvent.click(screen.getByRole('button', { name: /upload recording/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /transcribe speech/i })).toBeInTheDocument()
    })

    // Click Transcribe Speech
    fireEvent.click(screen.getByRole('button', { name: /transcribe speech/i }))

    // Transcript view appears
    await waitFor(() => {
      expect(screen.getByText('Recognised Speech Transcript')).toBeInTheDocument()
    })

    // Recognized text safely rendered as text
    expect(
      screen.getByText('Distributed caching enhances scalability and reduces latency.')
    ).toBeInTheDocument()

    // Academic Integrity Notice present
    expect(screen.getByText(/Academic Integrity Notice/i)).toBeInTheDocument()

    // Toggle segment breakdown
    const toggleBtn = screen.getByRole('button', { name: /view timestamped segments/i })
    fireEvent.click(toggleBtn)

    expect(screen.getByText(/hide timestamped segments/i)).toBeInTheDocument()
    expect(screen.getByText(/\[00:00 - 00:03\]/)).toBeInTheDocument()
  })

  it('displays transcription failure banner and allows retry', async () => {
    const fetchSpy = vi.fn()
    // Upload succeeds
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        session_id: 'sess_test_1',
        exercise_id: 'tech-caching',
        take_number: 1,
        file_id: 'take_1.webm',
        byte_size: 12000,
        mime_type: 'audio/webm',
        created_at: '2026-10-12T12:00:00Z',
        status: 'uploaded',
      }),
    })
    // Transcribe fails with 503
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({
        error: {
          code: 'TRANSCRIPTION_QUEUE_FULL',
          message: 'Worker queue is currently full. Please retry in a few moments.',
        },
      }),
    })

    globalThis.fetch = fetchSpy

    const onRecordAnother = vi.fn()
    render(
      <AudioPlayer
        audioUrl={fakeUrl}
        audioBlob={fakeBlob}
        mimeType="audio/webm"
        exerciseTitle="Distributed Caching"
        exerciseId="tech-caching"
        sessionId="sess_test_1"
        takeNumber={1}
        onRecordAnotherTake={onRecordAnother}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /upload recording/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /transcribe speech/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /transcribe speech/i }))

    await waitFor(() => {
      expect(screen.getByText('Transcription Failed')).toBeInTheDocument()
    })

    expect(
      screen.getByText('Worker queue is currently full. Please retry in a few moments.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry transcription/i })).toBeInTheDocument()

    // Player and recording intact
    expect(screen.getByRole('button', { name: /play recorded audio/i })).toBeInTheDocument()
  })
})
