import Groq from 'groq-sdk'
import type { LlmEvaluation } from '../schemas.js'
import { parseLlmEvaluation } from '../schemas.js'
import type {
  EvaluationContext,
  LlmCallResult,
  LlmEvaluator,
} from './types.js'

const EVAL_JSON_SHAPE = [
  'Required JSON shape:',
  '{',
  '  "score": <integer 1-10>,',
  '  "summary": <string>,',
  '  "strengths": <string[]>,',
  '  "weaknesses": <string[]>,',
  '  "followUpQuestion": { "question": string, "reason": string, "expectedConcepts": string[] } | null,',
  '  "suggestedImprovements": [{ "title": string, "description": string, "priority": "low"|"medium"|"high" }],',
  '  "technologyFeedback": [{ "technology": string, "decision": "excellent"|"reasonable"|"suboptimal"|"incorrect", "reason": string }],',
  '  "finalFeedback": <string|null>',
  '}',
  'Use lowercase enums. score must be an integer. Prefer concise arrays (≤4 items each).',
].join('\n')

export type GroqAdapterConfig = {
  apiKey: string
  model: string
  maxCompletionTokens: number
  /** Per-request timeout (ms). */
  timeoutMs?: number
  /** Extra attempts after the first failure (429/5xx/timeout). */
  maxRetries?: number
  client?: Groq
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function isRetryable(err: unknown): boolean {
  const status =
    err && typeof err === 'object' && 'status' in err
      ? Number((err as { status?: number }).status)
      : undefined
  if (status === 429 || (status != null && status >= 500)) return true
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err)
  return (
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  )
}

/**
 * Official Groq SDK adapter with timeout, limited retries, and usage capture.
 */
export function createGroqAdapter(config: GroqAdapterConfig): LlmEvaluator {
  const timeoutMs = config.timeoutMs ?? 25_000
  const maxRetries = config.maxRetries ?? 2
  const client =
    config.client ??
    new Groq({
      apiKey: config.apiKey,
      timeout: timeoutMs,
      maxRetries: 0, // we control retries ourselves
    })

  return {
    async evaluate(ctx: EvaluationContext): Promise<LlmCallResult> {
      const system = [
        ctx.rubricPrompt,
        'Respond with ONLY valid JSON matching the evaluation schema.',
        EVAL_JSON_SHAPE,
        'Do not include markdown fences.',
        'Do not set passed yourself; the server enforces the pass threshold.',
      ].join('\n')

      const user = JSON.stringify({ architecture: ctx.submit })

      let lastError: unknown
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const completion = await client.chat.completions.create({
            model: config.model,
            temperature: 0.2,
            max_tokens: config.maxCompletionTokens,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          })

          const content = completion.choices[0]?.message?.content
          if (!content) {
            throw new Error('Groq returned empty content')
          }

          let parsedJson: unknown
          try {
            parsedJson = JSON.parse(content)
          } catch {
            throw new Error('Groq returned non-JSON content')
          }

          const validated = parseLlmEvaluation(parsedJson)
          if (!validated.success) {
            const issues = validated.error.issues
              .slice(0, 5)
              .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
              .join('; ')
            console.error('[groq] schema validation failed:', issues)
            console.error(
              '[groq] raw keys:',
              parsedJson && typeof parsedJson === 'object'
                ? Object.keys(parsedJson as object).join(',')
                : typeof parsedJson,
            )
            throw new Error('Groq JSON failed schema validation')
          }

          const usage = completion.usage
            ? {
                promptTokens: completion.usage.prompt_tokens ?? 0,
                completionTokens: completion.usage.completion_tokens ?? 0,
              }
            : undefined

          return { evaluation: validated.data as LlmEvaluation, usage }
        } catch (err) {
          lastError = err
          const schemaFail =
            err instanceof Error &&
            err.message.includes('schema validation')
          if (attempt < maxRetries && (isRetryable(err) || schemaFail)) {
            await sleep(300 * (attempt + 1))
            continue
          }
          break
        }
      }

      const message =
        lastError instanceof Error ? lastError.message : 'Groq request failed'
      throw new Error(message)
    },
  }
}
