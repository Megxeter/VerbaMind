import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('handles acoustic delivery analysis workflow and renders measurements panel', async () => {
    const mockAcousticData = {
      total_duration_seconds: 47.16,
      detected_speech_duration_seconds: 41.01,
      speech_activity_ratio: 0.87,
      speech_activity_percentage: 87.0,
      leading_silence_seconds: 0.44,
      trailing_silence_seconds: 0.7,
      internal_gaps: [
        { start_seconds: 0.58, end_seconds: 1.53, duration_seconds: 0.94 },
        { start_seconds: 6.12, end_seconds: 6.73, duration_seconds: 0.61 },
      ],
      internal_gap_count: 2,
      total_internal_gap_duration_seconds: 1.55,
      mean_internal_gap_duration_seconds: 0.78,
      transcript_word_count: 94,
      words_per_minute_total: 119.6,
      words_per_minute_speech_only: 137.5,
      rate_is_transcript_dependent: true,
      detector_type: 'frame_energy_rms',
      energy_threshold_db: -40.0,
      min_gap_duration_seconds: 0.25,
      sample_rate_hz: 16000,
    }

    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/recording') && !url.includes('/acoustics')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            session_id: 'sess_test_1',
            exercise_id: 'tech-caching',
            take_number: 1,
            file_id: 'take_1.webm',
            byte_size: 15360,
            mime_type: 'audio/webm',
            status: 'uploaded',
          }),
        }
      }
      if (url.includes('/acoustics')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockAcousticData,
        }
      }
      return { ok: false, status: 404 }
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
      expect(screen.getByRole('button', { name: /analyze delivery/i })).toBeInTheDocument()
    })

    // Click Analyze Delivery
    fireEvent.click(screen.getByRole('button', { name: /analyze delivery/i }))

    await waitFor(() => {
      expect(screen.getByText('Audio Delivery Measurements')).toBeInTheDocument()
    })

    // Check displayed measurements
    expect(screen.getByText('47.2s')).toBeInTheDocument() // Total duration
    expect(screen.getByText('41.0s')).toBeInTheDocument() // Active speech
    expect(screen.getByText('87.0%')).toBeInTheDocument() // Speech activity
    expect(screen.getByText('0.44s')).toBeInTheDocument() // Leading silence
    expect(screen.getByText('0.70s')).toBeInTheDocument() // Trailing silence
    expect(screen.getByText('120 WPM')).toBeInTheDocument() // Speaking pace (rounded)
    expect(screen.getByText(/138 WPM articulation rate/i)).toBeInTheDocument()

    // Expand gaps
    expect(screen.getByText(/Internal Non-Speech Gaps/i)).toBeInTheDocument()
    expect(screen.getByText(/2 gaps/i)).toBeInTheDocument()
    const toggleGapsBtn = screen.getByRole('button', { name: /view internal gaps breakdown/i })
    expect(toggleGapsBtn).toBeInTheDocument()
    fireEvent.click(toggleGapsBtn)

    expect(screen.getByText('Gap #1')).toBeInTheDocument()
    expect(screen.getByText('0.94s duration')).toBeInTheDocument()

    // Test clickable gap seeking and playback behavior
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const gap1Btn = screen.getByRole('button', { name: /play audio around gap #1/i })
    expect(gap1Btn).toBeInTheDocument()
    expect(gap1Btn).toHaveAttribute('title')

    // Click Gap 1 (start 0.58s -> clamped to 0s)
    fireEvent.click(gap1Btn)
    await waitFor(() => {
      expect(playSpy).toHaveBeenCalled()
    })

    // Click Gap 2 (start 6.12s -> seeks to 6.12 - 0.75 = 5.37s)
    const gap2Btn = screen.getByRole('button', { name: /play audio around gap #2/i })
    expect(gap2Btn).toBeInTheDocument()
    fireEvent.click(gap2Btn)
    await waitFor(() => {
      expect(playSpy).toHaveBeenCalledTimes(2)
    })

    playSpy.mockRestore()

    // Scientific invariants: no mock fluency, pronunciation, or confidence score metrics
    expect(screen.queryByText(/Overall Assessment/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Confidence Score/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Fluency Rating/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pronunciation Rating/i)).not.toBeInTheDocument()
  })

  it('displays failure banner and retry button when acoustic analysis fails', async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/recording') && !url.includes('/acoustics')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            session_id: 'sess_test_1',
            exercise_id: 'tech-caching',
            take_number: 1,
            file_id: 'take_1.webm',
            byte_size: 15360,
            mime_type: 'audio/webm',
            status: 'uploaded',
          }),
        }
      }
      if (url.includes('/acoustics')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({
            error: { code: 'ACOUSTIC_ANALYSIS_FAILED', message: 'Decoding error in media stream.' },
          }),
        }
      }
      return { ok: false, status: 404 }
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
      expect(screen.getByRole('button', { name: /analyze delivery/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /analyze delivery/i }))

    await waitFor(() => {
      expect(screen.getByText('Acoustic Analysis Failed')).toBeInTheDocument()
    })

    expect(screen.getByText('Decoding error in media stream.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry delivery analysis/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play recorded audio/i })).toBeInTheDocument()
  })

  it('clears previous measurements and transcript when switching to another take, rejecting stale responses', async () => {
    const mockAcousticData = {
      total_duration_seconds: 13.44,
      detected_speech_duration_seconds: 9.94,
      speech_activity_ratio: 0.74,
      speech_activity_percentage: 74.0,
      leading_silence_seconds: 2.14,
      trailing_silence_seconds: 0.35,
      internal_gaps: [{ start_seconds: 8.445, end_seconds: 9.16, duration_seconds: 0.715 }],
      internal_gap_count: 1,
      total_internal_gap_duration_seconds: 0.715,
      mean_internal_gap_duration_seconds: 0.715,
      transcript_word_count: 22,
      words_per_minute_total: 98.2,
      words_per_minute_speech_only: 132.8,
      rate_is_transcript_dependent: true,
      detector_type: 'frame_energy_rms',
      energy_threshold_db: -40.0,
      min_gap_duration_seconds: 0.25,
      sample_rate_hz: 16000,
    }

    const mockTranscript = {
      text: 'Take 1 speech transcript text.',
      segments: [],
      language: 'en',
      language_probability: 1.0,
      duration_seconds: 13.44,
      processing_time_seconds: 1.5,
      model_name: 'base.en',
      device: 'cpu',
      compute_type: 'int8',
      word_count: 5,
    }

    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/recording') && !url.includes('/acoustics') && !url.includes('/transcribe')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            session_id: 'sess_test_1',
            exercise_id: 'tech-caching',
            take_number: 1,
            file_id: 'take_1.webm',
            byte_size: 15360,
            mime_type: 'audio/webm',
            status: 'uploaded',
          }),
        }
      }
      if (url.includes('/transcribe')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            job_id: 'job_1',
            session_id: 'sess_test_1',
            take_number: 1,
            status: 'completed',
            transcript: mockTranscript,
          }),
        }
      }
      if (url.includes('/acoustics')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockAcousticData,
        }
      }
      return { ok: false, status: 404 }
    })

    globalThis.fetch = fetchSpy
    const onRecordAnother = vi.fn()

    const { rerender } = render(
      <AudioPlayer
        audioUrl="blob:http://localhost/take-1"
        audioBlob={fakeBlob}
        mimeType="audio/webm"
        exerciseTitle="Distributed Caching"
        exerciseId="tech-caching"
        sessionId="sess_test_1"
        takeNumber={1}
        onRecordAnotherTake={onRecordAnother}
      />
    )

    // Upload, transcribe, and analyze delivery for Take 1
    fireEvent.click(screen.getByRole('button', { name: /upload recording/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /analyze delivery/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /transcribe speech/i }))
    await waitFor(() => {
      expect(screen.getByText('Take 1 speech transcript text.')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /analyze delivery/i }))
    await waitFor(() => {
      expect(screen.getByText('Audio Delivery Measurements')).toBeInTheDocument()
    })

    // Confirm take 1 measurements are visible
    expect(screen.getByText('13.4s')).toBeInTheDocument()
    expect(screen.getByText('Take 1 speech transcript text.')).toBeInTheDocument()

    // Simulate switching to Take 2 (new audioUrl and takeNumber)
    rerender(
      <AudioPlayer
        audioUrl="blob:http://localhost/take-2"
        audioBlob={new Blob(['take2'], { type: 'audio/webm' })}
        mimeType="audio/webm"
        exerciseTitle="Distributed Caching"
        exerciseId="tech-caching"
        sessionId="sess_test_1"
        takeNumber={2}
        onRecordAnotherTake={onRecordAnother}
      />
    )

    // Assert that previous take's measurements and transcript are completely cleared
    expect(screen.queryByText('Audio Delivery Measurements')).not.toBeInTheDocument()
    expect(screen.queryByText('Take 1 speech transcript text.')).not.toBeInTheDocument()
    expect(screen.queryByText('Recognised Speech Transcript')).not.toBeInTheDocument()
    expect(screen.queryByText('Approximate Alignment')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /view internal gaps breakdown/i })).not.toBeInTheDocument()

    // Assert button is back to initial state for Take 2
    expect(screen.getByRole('button', { name: /upload recording/i })).toBeInTheDocument()
    expect(screen.getByText(/Take #2 Captured/i)).toBeInTheDocument()
  })

  it('supports interactive transcript playback with word seeking, active highlight, fallback segment seeking, and precise decimal gap timestamps', async () => {
    const mockAcousticData = {
      total_duration_seconds: 10.0,
      detected_speech_duration_seconds: 8.5,
      speech_activity_ratio: 0.85,
      speech_activity_percentage: 85.0,
      leading_silence_seconds: 0.5,
      trailing_silence_seconds: 0.4,
      internal_gaps: [
        { start_seconds: 5.01, end_seconds: 5.29, duration_seconds: 0.28 },
        { start_seconds: 8.45, end_seconds: 9.16, duration_seconds: 0.71 },
      ],
      internal_gap_count: 2,
      total_internal_gap_duration_seconds: 0.99,
      mean_internal_gap_duration_seconds: 0.5,
      transcript_word_count: 5,
      words_per_minute_total: 60.0,
      words_per_minute_speech_only: 70.6,
      rate_is_transcript_dependent: true,
      detector_type: 'frame_energy_rms',
      energy_threshold_db: -40.0,
      min_gap_duration_seconds: 0.25,
      sample_rate_hz: 16000,
    }

    const mockTranscriptWithWordsAndFallback = {
      text: 'First second third fallback segment.',
      segments: [
        {
          id: 0,
          start: 1.0,
          end: 3.0,
          text: 'First second',
          words: [
            { word: 'First', start: 1.0, end: 1.8, probability: 0.99 },
            { word: 'second', start: 1.9, end: 2.8, probability: 0.95 },
          ],
        },
        {
          id: 1,
          start: 3.5,
          end: 6.0,
          text: 'third fallback segment.',
          words: [],
        },
      ],
      language: 'en',
      language_probability: 1.0,
      duration_seconds: 10.0,
      processing_time_seconds: 0.9,
      model_name: 'base.en',
      device: 'cpu',
      compute_type: 'int8',
      word_count: 5,
    }

    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/recording') && !url.includes('/acoustics') && !url.includes('/transcribe')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            session_id: 'sess_test_1',
            exercise_id: 'tech-caching',
            take_number: 1,
            file_id: 'take_1.webm',
            byte_size: 15360,
            mime_type: 'audio/webm',
            status: 'uploaded',
          }),
        }
      }
      if (url.includes('/transcribe')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            job_id: 'job_1',
            session_id: 'sess_test_1',
            take_number: 1,
            status: 'completed',
            transcript: mockTranscriptWithWordsAndFallback,
          }),
        }
      }
      if (url.includes('/acoustics')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockAcousticData,
        }
      }
      return { ok: false, status: 404 }
    })

    globalThis.fetch = fetchSpy
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
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

    // Upload, transcribe, and analyze delivery
    fireEvent.click(screen.getByRole('button', { name: /upload recording/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /transcribe speech/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /transcribe speech/i }))
    await waitFor(() => {
      expect(screen.getByText('Recognised Speech Transcript')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /analyze delivery/i }))
    await waitFor(() => {
      expect(screen.getByText('Audio Delivery Measurements')).toBeInTheDocument()
    })

    // 1. Verify alignment badge and disclaimer
    expect(screen.getByText('Approximate Alignment')).toBeInTheDocument()
    expect(screen.getByText(/Academic Integrity Notice/i)).toBeInTheDocument()
    expect(screen.getByText(/approximate cross-attention alignments/i)).toBeInTheDocument()
    expect(screen.getByText(/phoneme-level ground truth/i)).toBeInTheDocument()

    // 2. Verify gap timestamps display with decimal seconds (avoiding identical start/end rounded numbers)
    const toggleGapsBtn = screen.getByRole('button', { name: /view internal gaps breakdown/i })
    fireEvent.click(toggleGapsBtn)
    expect(screen.getByText(/\[00:05.01 – 00:05.29\]/)).toBeInTheDocument()
    expect(screen.getByText(/\[00:08.45 – 00:09.16\]/)).toBeInTheDocument()

    // 3. Test interactive word buttons
    const wordFirstBtn = screen.getByRole('button', { name: /play audio at word "First"/i })
    const wordSecondBtn = screen.getByRole('button', { name: /play audio at word "second"/i })
    expect(wordFirstBtn).toBeInTheDocument()
    expect(wordSecondBtn).toBeInTheDocument()

    // Clicking word "second" (start: 1.9s) seeks to max(0, 1.9 - 0.25) = 1.65s and plays
    act(() => {
      fireEvent.click(wordSecondBtn)
    })
    expect(playSpy).toHaveBeenCalled()

    // 4. Test word active highlighting
    const audioElement = document.querySelector('audio') as HTMLAudioElement
    expect(audioElement).toBeInTheDocument()

    // Set currentTime to 2.2s (inside word "second" interval [1.9, 2.8])
    Object.defineProperty(audioElement, 'currentTime', { value: 2.2, writable: true, configurable: true })
    act(() => {
      fireEvent.timeUpdate(audioElement)
    })

    await waitFor(() => {
      expect(wordSecondBtn).toHaveClass('transcript-word-active')
      expect(wordFirstBtn).not.toHaveClass('transcript-word-active')
    })

    // 5. Test segment fallback when words are unavailable
    const fallbackSegBtn = screen.getByRole('button', { name: /play audio for segment "third fallback segment."/i })
    expect(fallbackSegBtn).toBeInTheDocument()

    act(() => {
      fireEvent.click(fallbackSegBtn)
    })
    expect(playSpy).toHaveBeenCalled()

    // Set currentTime to 4.5s (inside segment interval [3.5, 6.0])
    Object.defineProperty(audioElement, 'currentTime', { value: 4.5, writable: true, configurable: true })
    act(() => {
      fireEvent.timeUpdate(audioElement)
    })

    await waitFor(() => {
      expect(fallbackSegBtn).toHaveClass('transcript-segment-active')
      expect(wordSecondBtn).not.toHaveClass('transcript-word-active')
    })

    // 6. Test timestamped segments list rows
    const toggleSegmentsBtn = screen.getByRole('button', { name: /view timestamped segments/i })
    fireEvent.click(toggleSegmentsBtn)

    const segRow0Btn = screen.getByRole('button', { name: /play segment from 00:01: First second/i })
    expect(segRow0Btn).toBeInTheDocument()
    fireEvent.click(segRow0Btn)
    expect(playSpy).toHaveBeenCalled()

    playSpy.mockRestore()
  })
})

