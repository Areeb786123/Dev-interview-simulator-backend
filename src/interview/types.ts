import type {
  ArchitectureSubmit,
  EvaluationResult,
  FollowUpQuestion,
} from '../evaluation/schemas.js'

export type InterviewStatus =
  | 'IN_PROGRESS'
  | 'NEEDS_REVISION'
  | 'PASSED'
  | 'FAILED'
  | 'ABANDONED'

export type { FollowUpQuestion }

export type TokenUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
}

export type InterviewEvent = {
  id: string
  at: string
  type:
    | 'started'
    | 'evaluated'
    | 'answered'
    | 'revised'
    | 'passed'
    | 'capped'
    | 'failed'
    | 'abandoned'
  summary: string
  score?: number
  status?: InterviewStatus
}

export type InterviewRecord = {
  id: string
  clientId: string
  levelId: string
  mapId: string
  status: InterviewStatus
  evaluateAttempts: number
  answerAttempts: number
  createdAt: string
  updatedAt: string
  latestArchitecture: ArchitectureSubmit | null
  latestEvaluation: EvaluationResult | null
  pendingFollowUp: FollowUpQuestion | null
  history: InterviewEvent[]
  tokenUsage: TokenUsage
}

export type InterviewLimits = {
  maxEvaluateAttempts: number
  maxAnswerAttempts: number
}

export function isTerminalStatus(status: InterviewStatus): boolean {
  return status === 'PASSED' || status === 'FAILED' || status === 'ABANDONED'
}

export function canEvaluateStatus(status: InterviewStatus): boolean {
  return status === 'IN_PROGRESS' || status === 'NEEDS_REVISION'
}
