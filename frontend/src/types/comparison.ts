import type { AcousticMeasurements } from '../hooks/useAcoustics'
import type { TranscriptData } from '../hooks/useTranscription'

export interface StoredAttempt {
  takeNumber: number
  exerciseId: string
  exerciseTitle: string
  audioBlob: Blob | null
  audioUrl: string
  mimeType: string | null
  measurements: AcousticMeasurements | null
  transcript: TranscriptData | null
  createdAt: string
}

export interface MetricComparisonItem {
  key: string
  label: string
  unit: string
  differenceUnit?: string
  baselineValue: number | null
  currentValue: number | null
  difference: number | null
  formattedBaseline: string
  formattedCurrent: string
  formattedDifference: string
  notes?: string
}

export interface CompatibilityReport {
  isCompatible: boolean
  sameExercise: boolean
  sameDetectorThreshold: boolean
  sameDetectorMinGap: boolean
  sameRecognizerModel: boolean
  warnings: string[]
}

export interface AttemptComparisonResult {
  baselineTakeNumber: number
  currentTakeNumber: number
  exerciseTitle: string
  compatibility: CompatibilityReport
  metrics: {
    recordingDuration: MetricComparisonItem
    speechActiveDuration: MetricComparisonItem
    speechActivityPercentage: MetricComparisonItem
    internalGapCount: MetricComparisonItem
    totalGapDuration: MetricComparisonItem
    meanGapDuration: MetricComparisonItem
    wpmTotal: MetricComparisonItem
    wpmSpeechOnly: MetricComparisonItem
  }
  hasTranscriptBaseline: boolean
  hasTranscriptCurrent: boolean
}
