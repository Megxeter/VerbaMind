import { describe, expect, it } from 'vitest'
import { SAMPLE_EXERCISES } from './exercises'

describe('Exercise Catalog Integrity', () => {
  it('contains at least 3 diverse exercises', () => {
    expect(SAMPLE_EXERCISES.length).toBeGreaterThanOrEqual(3)
  })

  it('ensures each exercise has valid required metadata', () => {
    SAMPLE_EXERCISES.forEach((exercise) => {
      expect(exercise.id).toBeTruthy()
      expect(exercise.title).toBeTruthy()
      expect(exercise.passage.length).toBeGreaterThan(100)
      expect(exercise.wordCount).toBeGreaterThan(40)
      expect(exercise.targetWpm).toBeGreaterThanOrEqual(120)
      expect(exercise.targetWpm).toBeLessThanOrEqual(160)
      expect(exercise.guidanceTips.length).toBeGreaterThanOrEqual(2)
      expect(exercise.challengingWords.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('covers technical and HR placement categories', () => {
    const categories = new Set(SAMPLE_EXERCISES.map((e) => e.category))
    expect(categories.has('technical')).toBe(true)
    expect(categories.has('hr-placement')).toBe(true)
  })
})
