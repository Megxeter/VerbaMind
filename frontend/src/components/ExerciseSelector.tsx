import React, { useState } from 'react'
import type { Exercise, ExerciseCategory } from '../types/exercise'

interface ExerciseSelectorProps {
  exercises: Exercise[]
  selectedExercise: Exercise
  onSelectExercise: (exercise: Exercise) => void
  disabled?: boolean
}

export const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({
  exercises,
  selectedExercise,
  onSelectExercise,
  disabled = false,
}) => {
  const [filterCategory, setFilterCategory] = useState<ExerciseCategory | 'all'>('all')

  const filteredExercises = exercises.filter((ex) => {
    if (filterCategory === 'all') return true
    return ex.category === filterCategory
  })

  return (
    <div className="exercise-selector-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">1. Choose a Read-Aloud Practice Passage</h2>
          <p className="section-subtitle">
            Select a placement-focused scenario to train pacing, articulation, and breathing.
          </p>
        </div>

        {/* Category Filters */}
        <div className="category-filters" role="tablist" aria-label="Exercise category filters">
          <button
            type="button"
            className={`filter-btn ${filterCategory === 'all' ? 'filter-active' : ''}`}
            onClick={() => setFilterCategory('all')}
          >
            All Passages ({exercises.length})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterCategory === 'hr-placement' ? 'filter-active' : ''}`}
            onClick={() => setFilterCategory('hr-placement')}
          >
            HR & Behavioral
          </button>
          <button
            type="button"
            className={`filter-btn ${filterCategory === 'technical' ? 'filter-active' : ''}`}
            onClick={() => setFilterCategory('technical')}
          >
            Technical Explanations
          </button>
        </div>
      </div>

      {/* Exercise Card Grid */}
      <div className="exercise-grid">
        {filteredExercises.map((ex) => {
          const isSelected = ex.id === selectedExercise.id
          return (
            <button
              key={ex.id}
              type="button"
              className={`exercise-card ${isSelected ? 'exercise-card-selected' : ''}`}
              onClick={() => onSelectExercise(ex)}
              disabled={disabled}
              id={`exercise-card-${ex.id}`}
            >
              <div className="exercise-card-header">
                <span className={`badge badge-difficulty-${ex.difficulty.toLowerCase()}`}>
                  {ex.difficulty}
                </span>
                <span className="exercise-duration">⏱ ~{ex.estimatedDurationSeconds}s</span>
              </div>

              <h3 className="exercise-card-title">{ex.title}</h3>
              <p className="exercise-card-summary">{ex.summary}</p>

              <div className="exercise-meta-row">
                <span className="meta-item">
                  <strong>{ex.wordCount}</strong> words
                </span>
                <span className="meta-separator">•</span>
                <span className="meta-item">
                  Target: <strong>{ex.targetWpm}</strong> WPM
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected Exercise Full Reading Prompt Display */}
      <div className="reading-prompt-display">
        <div className="prompt-header">
          <div className="prompt-title-group">
            <span className="badge badge-accent">Active Reading Prompt</span>
            <h3 className="prompt-title">{selectedExercise.title}</h3>
          </div>
          <div className="prompt-metrics-badge">
            <span>{selectedExercise.wordCount} Words</span>
            <span>•</span>
            <span>Target Pacing: ~{selectedExercise.targetWpm} WPM ({selectedExercise.estimatedDurationSeconds}s)</span>
          </div>
        </div>

        {/* The Passage text to be read aloud */}
        <div className="passage-content" id="active-passage-text">
          <p className="passage-text">{selectedExercise.passage}</p>
        </div>

        {/* Guidance and Challenging Vocabulary */}
        <div className="guidance-grid">
          <div className="guidance-card">
            <h4 className="guidance-heading">
              <span className="guidance-icon">🎯</span> Pacing & Articulation Guidance
            </h4>
            <ul className="guidance-list">
              {selectedExercise.guidanceTips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="guidance-card">
            <h4 className="guidance-heading">
              <span className="guidance-icon">🗣️</span> Key Focus Words
            </h4>
            <div className="challenging-words-wrap">
              {selectedExercise.challengingWords.map((word, idx) => (
                <span key={idx} className="word-chip">
                  {word}
                </span>
              ))}
            </div>
            <p className="guidance-footnote">
              Articulate each syllable crisply without swallowing final consonants.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
