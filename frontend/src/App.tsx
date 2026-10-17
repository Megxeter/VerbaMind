import React, { useState } from 'react'
import { Header } from './components/Header'
import { ExerciseSelector } from './components/ExerciseSelector'
import { AudioVisualizer } from './components/AudioVisualizer'
import { RecorderControls } from './components/RecorderControls'
import { AudioPlayer } from './components/AudioPlayer'
import { MicPermissionNotice } from './components/MicPermissionNotice'
import { SAMPLE_EXERCISES } from './data/exercises'
import type { Exercise } from './types/exercise'
import { useAudioRecorder } from './hooks/useAudioRecorder'
import { useAttemptComparison } from './hooks/useAttemptComparison'

export const App: React.FC = () => {
  const [selectedExercise, setSelectedExercise] = useState<Exercise>(SAMPLE_EXERCISES[0])
  const [takeNumber, setTakeNumber] = useState<number>(1)
  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false)
  const [sessionId] = useState<string>(
    () => `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
  )

  const { baselineAttempt, setBaseline, clearBaseline } = useAttemptComparison()

  const {
    status,
    error,
    elapsedSeconds,
    maxSeconds,
    audioLevel,
    audioBlob,
    audioUrl,
    mimeType,
    requestPermission,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder()

  const isRecording = status === 'recording'
  const isPaused = status === 'paused'

  const handleSelectExercise = (exercise: Exercise) => {
    // Only allow changing exercises when not actively recording
    if (isRecording || isPaused) return
    setSelectedExercise(exercise)
    resetRecording()
    setTakeNumber(1)
  }

  const handleExplicitPermissionRequest = async () => {
    setIsRequestingPermission(true)
    await requestPermission()
    setIsRequestingPermission(false)
  }

  const handleStart = async () => {
    await startRecording()
  }

  const handleRecordAnotherTake = () => {
    setTakeNumber((prev) => prev + 1)
    resetRecording()
  }

  return (
    <div className="app-shell">
      <Header />

      <main className="main-content container">
        {/* Academic Project Status Banner */}
        <section className="banner-academic" aria-label="Project Status">
          <div className="banner-icon" aria-hidden="true">🎓</div>
          <div className="banner-text">
            <strong>B.Tech AI/ML Final Year Project — Phase 1: Voice Capture Engine</strong>
            <p>
              Targeting placement readiness. The evaluation engine strictly separates <em>Acoustic Fluency</em> from <em>Reading Accuracy</em> and <em>Pronunciation Clarity</em>.
            </p>
          </div>
        </section>

        {/* Section 1: Choose Read-Aloud Exercise */}
        <ExerciseSelector
          exercises={SAMPLE_EXERCISES}
          selectedExercise={selectedExercise}
          onSelectExercise={handleSelectExercise}
          disabled={isRecording || isPaused}
        />

        {/* Section 2: Browser Voice Recording Studio */}
        <section className="studio-section" id="recording-studio">
          <div className="section-header">
            <div>
              <h2 className="section-title">2. Record Your Spoken Reading</h2>
              <p className="section-subtitle">
                Read the highlighted passage aloud into your microphone. Keep your pacing natural.
              </p>
            </div>
          </div>

          {/* Microphone Permission Diagnostic Banner */}
          <MicPermissionNotice
            error={error}
            onRequestPermission={handleExplicitPermissionRequest}
            isRequesting={isRequestingPermission}
          />

          <div className="studio-card">
            {/* Retained Baseline Notification during Recording/Processing */}
            {baselineAttempt && status !== 'stopped' && (
              <div className="baseline-banner-studio" id="baseline-active-banner">
                <div className="baseline-banner-content">
                  <span className="badge badge-accent">Comparison Baseline Retained</span>
                  <span className="baseline-banner-text">
                    Take #{baselineAttempt.takeNumber} ({baselineAttempt.exerciseTitle}) is active as baseline. Record and analyse Take #{takeNumber} to compare delivery.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={clearBaseline}
                  title="Clear retained baseline and release memory"
                  id="studio-clear-baseline-btn"
                >
                  Clear Baseline
                </button>
              </div>
            )}

            {/* Live Audio Visualizer */}
            <AudioVisualizer
              isRecording={isRecording}
              isPaused={isPaused}
              audioLevel={audioLevel}
            />

            {/* Controls Bar & Timer */}
            <RecorderControls
              status={status}
              elapsedSeconds={elapsedSeconds}
              maxSeconds={maxSeconds}
              onStart={handleStart}
              onPause={pauseRecording}
              onResume={resumeRecording}
              onStop={stopRecording}
              onReset={resetRecording}
            />

            {/* Audio Playback Player when Take is Completed */}
            {status === 'stopped' && audioUrl && (
              <div className="player-mount-wrapper">
                <AudioPlayer
                  audioUrl={audioUrl}
                  audioBlob={audioBlob}
                  mimeType={mimeType}
                  exerciseTitle={selectedExercise.title}
                  exerciseId={selectedExercise.id}
                  sessionId={sessionId}
                  takeNumber={takeNumber}
                  onRecordAnotherTake={handleRecordAnotherTake}
                  baselineAttempt={baselineAttempt}
                  onSetBaseline={setBaseline}
                  onClearBaseline={clearBaseline}
                />
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p className="footer-copy">
            VERBAMIND &bull; Automated Speech & Placement Communication Coach &bull; B.Tech Final Year
          </p>
          <p className="footer-links">
            <span className="badge badge-subtle">Phase 1: Milestone 1 Active</span>
            <span className="badge badge-subtle">No Cloud Audio Leakage</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
