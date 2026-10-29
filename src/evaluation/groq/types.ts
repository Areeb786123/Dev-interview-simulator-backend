import type { ArchitectureSubmit, LlmEvaluation } from '../schemas.js'

export type EvaluationContext = {
  submit: ArchitectureSubmit
  rubricPrompt: string
}

export type LlmTokenUsage = {
  promptTokens: number
  completionTokens: number
}

export type LlmCallResult = {
  evaluation: LlmEvaluation
  usage?: LlmTokenUsage
}

/** Injectable LLM port — mock in tests; Groq SDK in production when keyed. */
export interface LlmEvaluator {
  evaluate(ctx: EvaluationContext): Promise<LlmCallResult>
}
