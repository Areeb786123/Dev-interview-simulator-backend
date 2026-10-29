import { Router } from 'express'
import { evaluateArchitecture } from '../evaluation/service.js'
import type { LlmEvaluator } from '../evaluation/groq/types.js'

export type EvaluateRouterDeps = {
  llm?: LlmEvaluator
}

export function createEvaluateRouter(deps: EvaluateRouterDeps = {}): Router {
  const router = Router()

  router.post('/api/v1/evaluate', async (req, res, next) => {
    try {
      const result = await evaluateArchitecture(req.body, { llm: deps.llm })

      if (!result.ok) {
        if (
          result.error === 'validation_error' ||
          result.error === 'structure_error'
        ) {
          res.status(400).json({
            ok: false,
            error: result.error,
            reason: result.reason,
            details: result.details,
          })
          return
        }
        if (result.error === 'llm_invalid_response') {
          res.status(502).json({
            ok: false,
            error: result.error,
          })
          return
        }
        res.status(502).json({ ok: false, error: result.error })
        return
      }

      res.status(200).json({
        ok: true,
        evaluation: result.evaluation,
        cached: result.cached ?? false,
        usage: result.usage,
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
