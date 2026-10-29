import { Router } from 'express'
import type { AppEnv } from '../config/env.js'

export function createHealthRouter(env: AppEnv): Router {
  const router = Router()

  router.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'dev_interview_simulator_backend',
      env: env.NODE_ENV,
      groq: {
        configured: env.groqConfigured,
        model: env.GROQ_MODEL,
        maxCompletionTokens: env.GROQ_MAX_COMPLETION_TOKENS,
      },
      database: {
        configured: env.databaseConfigured,
      },
      limits: {
        maxEvaluateAttempts: env.MAX_EVALUATE_ATTEMPTS,
        maxAnswerAttempts: env.MAX_ANSWER_ATTEMPTS,
        rateLimitMax: env.RATE_LIMIT_MAX,
        rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
      },
    })
  })

  return router
}
