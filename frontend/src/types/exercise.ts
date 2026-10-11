export type ExerciseCategory = 'hr-placement' | 'technical' | 'general'
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced'

export interface Exercise {
  id: string
  title: string
  category: ExerciseCategory
  difficulty: DifficultyLevel
  targetWpm: number // Expected speaking rate in words per minute (e.g. 130-150)
  wordCount: number
  estimatedDurationSeconds: number
  summary: string
  passage: string
  guidanceTips: string[]
  challengingWords: string[]
}

export type RecorderState =
  | 'idle'
  | 'requesting-permission'
  | 'ready'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'error'

export type MicPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported'

export interface MicError {
  code: 'PERMISSION_DENIED' | 'DEVICE_NOT_FOUND' | 'BUSY' | 'UNSUPPORTED' | 'UNKNOWN'
  message: string
  remediation: string
}

export interface RecordedAudioTake {
  id: string
  exerciseId: string
  blob: Blob
  audioUrl: string
  durationSeconds: number
  recordedAt: Date
  mimeType: string
  takeNumber: number
}
