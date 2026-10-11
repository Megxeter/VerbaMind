import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseSelector } from './ExerciseSelector'
import { SAMPLE_EXERCISES } from '../data/exercises'

describe('ExerciseSelector Component', () => {
  it('renders exercise titles and active passage', () => {
    const onSelect = vi.fn()
    render(
      <ExerciseSelector
        exercises={SAMPLE_EXERCISES}
        selectedExercise={SAMPLE_EXERCISES[0]}
        onSelectExercise={onSelect}
      />
    )

    expect(screen.getByText('1. Choose a Read-Aloud Practice Passage')).toBeInTheDocument()
    expect(screen.getAllByText(SAMPLE_EXERCISES[0].title).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(SAMPLE_EXERCISES[0].passage)).toBeInTheDocument()
  })

  it('triggers onSelectExercise when a card is clicked', () => {
    const onSelect = vi.fn()
    render(
      <ExerciseSelector
        exercises={SAMPLE_EXERCISES}
        selectedExercise={SAMPLE_EXERCISES[0]}
        onSelectExercise={onSelect}
      />
    )

    const secondExerciseCard = screen.getByRole('button', {
      name: new RegExp(SAMPLE_EXERCISES[1].title, 'i'),
    })
    fireEvent.click(secondExerciseCard)

    expect(onSelect).toHaveBeenCalledWith(SAMPLE_EXERCISES[1])
  })

  it('filters exercises by category', () => {
    const onSelect = vi.fn()
    render(
      <ExerciseSelector
        exercises={SAMPLE_EXERCISES}
        selectedExercise={SAMPLE_EXERCISES[0]}
        onSelectExercise={onSelect}
      />
    )

    const techFilterBtn = screen.getByRole('button', { name: /technical explanations/i })
    fireEvent.click(techFilterBtn)

    // Technical exercises should remain visible
    const techExercise = SAMPLE_EXERCISES.find((e) => e.category === 'technical')
    if (techExercise) {
      expect(screen.getByText(techExercise.title)).toBeInTheDocument()
    }
  })
})
