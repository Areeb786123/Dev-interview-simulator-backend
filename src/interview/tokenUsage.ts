import type { TokenUsage } from './types.js'

/** Rough public pricing placeholder for gpt-oss-20b-class models ($/1M tokens). */
const PROMPT_USD_PER_M = 0.1
const COMPLETION_USD_PER_M = 0.3

export function emptyTokenUsage(): TokenUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
  }
}

export function estimateTokensFromText(text: string): number {
  // ~4 chars/token heuristic — good enough for caps/telemetry
  return Math.max(1, Math.ceil(text.length / 4))
}

export function addUsage(
  current: TokenUsage,
  promptTokens: number,
  completionTokens: number,
): TokenUsage {
  const prompt = current.promptTokens + promptTokens
  const completion = current.completionTokens + completionTokens
  const total = prompt + completion
  const estimatedCostUsd =
    (prompt / 1_000_000) * PROMPT_USD_PER_M +
    (completion / 1_000_000) * COMPLETION_USD_PER_M
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(8)),
  }
}
