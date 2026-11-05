import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import type { AppEnv } from './config/env.js'
import type { LlmEvaluator } from './evaluation/groq/types.js'
import { createMockGroqAdapter } from './evaluation/groq/mockAdapter.js'
import { createGroqAdapter } from './evaluation/groq/groqAdapter.js'
import { createInterviewService } from './interview/service.js'
import type { InterviewStore } from './interview/store.js'
import { createMemoryInterviewStore } from './interview/memoryStore.js'
import { createEvaluateRouter } from './routes/evaluate.js'
import { createHealthRouter } from './routes/health.js'
import { createInterviewsRouter } from './routes/interviews.js'

export type CreateAppOptions = {
  llm?: LlmEvaluator
  interviewStore?: InterviewStore
}

export function resolveLlm(env: AppEnv, override?: LlmEvaluator): LlmEvaluator {
  if (override) return override
  if (env.groqConfigured) {
    return createGroqAdapter({
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
      maxCompletionTokens: env.GROQ_MAX_COMPLETION_TOKENS,
      timeoutMs: env.GROQ_TIMEOUT_MS,
      maxRetries: env.GROQ_MAX_RETRIES,
    })
  }
  return createMockGroqAdapter()
}

export function createApp(env: AppEnv, options: CreateAppOptions = {}) {
  const app = express()
  const llm = resolveLlm(env, options.llm)
  const interviewStore =
    options.interviewStore ?? createMemoryInterviewStore()
  const interviewService = createInterviewService({
    store: interviewStore,
    llm,
    limits: {
      maxEvaluateAttempts: env.MAX_EVALUATE_ATTEMPTS,
      maxAnswerAttempts: env.MAX_ANSWER_ATTEMPTS,
    },
  })

  app.disable('x-powered-by')
  app.use(cors({ origin: true }))
  app.use(express.json({ limit: '256kb' }))

  const apiLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'rate_limited' },
  })
  app.use('/api/', apiLimiter)

  app.use(createHealthRouter(env))
  app.use(createEvaluateRouter({ llm }))
  app.use(createInterviewsRouter(interviewService))

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const message =
        err instanceof Error ? err.message : 'Internal server error'
      console.error('[error]', message)
      res.status(500).json({ ok: false, error: 'internal_error' })
    },
  )

  return app
}
