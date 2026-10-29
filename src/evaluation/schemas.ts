import { z } from 'zod'

/** Server-enforced acceptance threshold (score ≥ this passes). */
export const PASS_THRESHOLD = 8 as const

const ComponentKindSchema = z.enum([
  'client',
  'server',
  'load-balancer',
  'postgres',
  'mongodb',
  'redis',
  'kafka',
  'object-store',
  'cdn',
  'websocket',
])

export const ArchitectureComponentSchema = z.object({
  id: z.string().min(1),
  kind: ComponentKindSchema,
  x: z.number(),
  y: z.number(),
})

export const ArchitectureConnectionSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
})

export const TechnologyDecisionSchema = z.object({
  componentId: z.string().min(1),
  technology: z.string().min(1),
  whyChosen: z.string().default(''),
  advantages: z.string().default(''),
  disadvantages: z.string().default(''),
  alternatives: z.string().default(''),
  bottleneck: z.string().default(''),
})

export const LevelWinContextSchema = z.object({
  requiredPath: z.array(z.string()).optional(),
  minCounts: z.record(z.number().int().nonnegative()).optional(),
})

export const LevelContextSchema = z
  .object({
    title: z.string().optional(),
    question: z.string().optional(),
    requirements: z.array(z.string()).optional(),
    win: LevelWinContextSchema.optional(),
    /** Soft structure gates for AI / Ultra — board text is enough. */
    reviewMode: z.enum(['base', 'ai', 'ultra']).optional(),
    architecturePath: z.string().optional(),
  })
  .optional()


export const ArchitectureSubmitSchema = z.object({
  levelId: z.string().min(1),
  mapId: z.string().min(1),
  components: z.array(ArchitectureComponentSchema).min(1),
  connections: z.array(ArchitectureConnectionSchema).default([]),
  decisions: z.array(TechnologyDecisionSchema).default([]),
  explanation: z.string().min(1),
  levelContext: LevelContextSchema,
})

export type ArchitectureSubmit = z.infer<typeof ArchitectureSubmitSchema>

export const FollowUpQuestionSchema = z.object({
  question: z.string().min(1),
  reason: z.string().min(1),
  expectedConcepts: z.array(z.string()).default([]),
})

export type FollowUpQuestion = z.infer<typeof FollowUpQuestionSchema>

export const SuggestedImprovementSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
})

export const TechnologyFeedbackSchema = z.object({
  technology: z.string().min(1),
  decision: z.enum([
    'excellent',
    'reasonable',
    'suboptimal',
    'incorrect',
  ]),
  reason: z.string().min(1),
})

/** Raw LLM payload — `passed` is NOT trusted from the model. */
export const LlmEvaluationSchema = z.object({
  score: z.number().int().min(1).max(10),
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  followUpQuestion: FollowUpQuestionSchema.nullable().default(null),
  suggestedImprovements: z.array(SuggestedImprovementSchema).default([]),
  technologyFeedback: z.array(TechnologyFeedbackSchema).default([]),
  finalFeedback: z.string().nullable().default(null),
})

export type LlmEvaluation = z.infer<typeof LlmEvaluationSchema>

function asTrimmedString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asTrimmedString).filter((s) => s.length > 0)
  }
  const single = asTrimmedString(value)
  return single ? [single] : []
}

function coerceScore(value: unknown): number | undefined {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : NaN
  if (!Number.isFinite(n)) return undefined
  return Math.min(10, Math.max(1, Math.round(n)))
}

function coercePriority(value: unknown): 'low' | 'medium' | 'high' {
  const s = asTrimmedString(value).toLowerCase()
  if (s === 'low' || s === 'medium' || s === 'high') return s
  if (s === 'critical' || s === 'urgent') return 'high'
  return 'medium'
}

const DECISION_ALIASES: Record<
  string,
  'excellent' | 'reasonable' | 'suboptimal' | 'incorrect'
> = {
  excellent: 'excellent',
  great: 'excellent',
  good: 'reasonable',
  reasonable: 'reasonable',
  ok: 'reasonable',
  okay: 'reasonable',
  acceptable: 'reasonable',
  fair: 'reasonable',
  suboptimal: 'suboptimal',
  poor: 'suboptimal',
  weak: 'suboptimal',
  incorrect: 'incorrect',
  wrong: 'incorrect',
  bad: 'incorrect',
}

function coerceDecision(
  value: unknown,
): 'excellent' | 'reasonable' | 'suboptimal' | 'incorrect' {
  const s = asTrimmedString(value).toLowerCase()
  return DECISION_ALIASES[s] ?? 'reasonable'
}

function coerceFollowUp(value: unknown): unknown {
  if (value == null || value === false || value === '') return null
  if (typeof value === 'string') {
    const q = value.trim()
    if (!q) return null
    return { question: q, reason: 'Clarifies a gap in the design.', expectedConcepts: [] }
  }
  if (typeof value !== 'object') return null
  const o = value as Record<string, unknown>
  const question = asTrimmedString(o.question ?? o.text ?? o.prompt)
  const reason = asTrimmedString(o.reason ?? o.why ?? o.rationale)
  if (!question) return null
  return {
    question,
    reason: reason || 'Clarifies a gap in the design.',
    expectedConcepts: asStringArray(o.expectedConcepts ?? o.concepts),
  }
}

function coerceImprovements(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') {
        const title = item.trim()
        if (!title) return null
        return { title, description: title, priority: 'medium' as const }
      }
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const title = asTrimmedString(o.title ?? o.name)
      const description = asTrimmedString(o.description ?? o.detail ?? o.text)
      if (!title && !description) return null
      return {
        title: title || description.slice(0, 80),
        description: description || title,
        priority: coercePriority(o.priority),
      }
    })
    .filter(Boolean)
}

function coerceTechFeedback(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const technology = asTrimmedString(o.technology ?? o.tech ?? o.name)
      const reason = asTrimmedString(o.reason ?? o.why ?? o.rationale)
      if (!technology) return null
      return {
        technology,
        decision: coerceDecision(o.decision ?? o.rating ?? o.verdict),
        reason: reason || 'No detailed rationale provided.',
      }
    })
    .filter(Boolean)
}

/**
 * Normalize common LLM JSON quirks before Zod validation
 * (float scores, string arrays, casing, wrapper objects, etc.).
 */
export function coerceLlmEvaluation(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const root = raw as Record<string, unknown>
  const nested =
    root.evaluation && typeof root.evaluation === 'object'
      ? (root.evaluation as Record<string, unknown>)
      : root.result && typeof root.result === 'object'
        ? (root.result as Record<string, unknown>)
        : root

  const score = coerceScore(nested.score ?? nested.rating) ?? 5
  const summary = asTrimmedString(nested.summary ?? nested.overview)
  const finalRaw = nested.finalFeedback ?? nested.closingFeedback
  const finalFeedback =
    finalRaw == null || finalRaw === false
      ? null
      : asTrimmedString(finalRaw) || null

  return {
    score,
    summary: summary || 'No summary provided.',
    strengths: asStringArray(nested.strengths),
    weaknesses: asStringArray(nested.weaknesses),
    followUpQuestion: coerceFollowUp(nested.followUpQuestion ?? nested.followUp),
    suggestedImprovements: coerceImprovements(
      nested.suggestedImprovements ?? nested.improvements,
    ),
    technologyFeedback: coerceTechFeedback(
      nested.technologyFeedback ?? nested.techFeedback,
    ),
    finalFeedback,
  }
}

/** Coerce then validate; returns Zod SafeParse result. */
export function parseLlmEvaluation(raw: unknown) {
  return LlmEvaluationSchema.safeParse(coerceLlmEvaluation(raw))
}

export type EvaluationResult = LlmEvaluation & {
  passed: boolean
}

/**
 * Enforce pass threshold server-side. Never trust model `passed` or
 * inconsistent follow-up / finalFeedback pairing.
 */
export function normalizeEvaluation(
  raw: LlmEvaluation,
): EvaluationResult {
  const score = Math.min(10, Math.max(1, Math.round(raw.score)))
  const passed = score >= PASS_THRESHOLD

  return {
    ...raw,
    score,
    passed,
    followUpQuestion: passed ? null : raw.followUpQuestion,
    finalFeedback: passed
      ? (raw.finalFeedback ??
        'Congratulations — this design meets the bar for this level.')
      : null,
  }
}
