import { buildRubricPrompt } from './rubric.js'
import { createMockGroqAdapter } from './groq/mockAdapter.js'
import type { LlmEvaluator } from './groq/types.js'
import {
  createEvalCache,
  hashEvaluationContext,
  type EvalCache,
} from './cache.js'
import { checkArchitectureStructure } from './structureCheck.js'
import {
  ArchitectureSubmitSchema,
  parseLlmEvaluation,
  normalizeEvaluation,
  type ArchitectureSubmit,
  type EvaluationResult,
} from './schemas.js'

export type EvaluateOk = {
  ok: true
  evaluation: EvaluationResult
  cached?: boolean
  usage?: { promptTokens: number; completionTokens: number }
}

export type EvaluateErr = {
  ok: false
  error:
    | 'validation_error'
    | 'structure_error'
    | 'llm_invalid_response'
    | 'llm_error'
  details?: unknown
  reason?: string
}

export type EvaluateResult = EvaluateOk | EvaluateErr

export type EvaluateOptions = {
  llm?: LlmEvaluator
  cache?: EvalCache
}

const defaultCache = createEvalCache()

export async function evaluateArchitecture(
  input: unknown,
  options: EvaluateOptions = {},
): Promise<EvaluateResult> {
  const parsed = ArchitectureSubmitSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_error',
      details: parsed.error.flatten(),
    }
  }

  const submit: ArchitectureSubmit = parsed.data
  const structure = checkArchitectureStructure(submit)
  if (!structure.ok) {
    return {
      ok: false,
      error: 'structure_error',
      reason: structure.reason,
      details: { code: structure.code },
    }
  }

  const llm = options.llm ?? createMockGroqAdapter()
  const cache = options.cache ?? defaultCache
  const rubricPrompt = buildRubricPrompt({
    title: submit.levelContext?.title,
    question: submit.levelContext?.question,
  })

  const cacheKey = hashEvaluationContext({
    submit,
    rubricPrompt,
  })
  const cached = cache.get(cacheKey)
  if (cached) {
    return {
      ok: true,
      evaluation: cached.evaluation,
      cached: true,
      usage: cached.usage,
    }
  }

  let rawUnknown: unknown
  let usage: { promptTokens: number; completionTokens: number } | undefined
  try {
    const call = await llm.evaluate({ submit, rubricPrompt })
    rawUnknown = call.evaluation
    usage = call.usage
  } catch (err) {
    const message = err instanceof Error ? err.message : 'llm failed'
    console.error('[evaluate] llm_error', message)
    return { ok: false, error: 'llm_error' }
  }

  const llmParsed = parseLlmEvaluation(rawUnknown)
  if (!llmParsed.success) {
    return {
      ok: false,
      error: 'llm_invalid_response',
      details: llmParsed.error.flatten(),
    }
  }

  const evaluation = normalizeEvaluation(llmParsed.data)
  cache.set(cacheKey, { evaluation, usage })

  return {
    ok: true,
    evaluation,
    cached: false,
    usage,
  }
}
