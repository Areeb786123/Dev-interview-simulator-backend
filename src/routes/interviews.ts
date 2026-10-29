import { Router } from 'express'
import type { InterviewService } from '../interview/service.js'

export function createInterviewsRouter(service: InterviewService): Router {
  const router = Router()

  router.post('/api/v1/interviews/start', async (req, res, next) => {
    try {
      const result = await service.start(req.body)
      if (!result.ok) {
        res.status(400).json({ ok: false, error: result.error, details: result.details })
        return
      }
      res.status(201).json({ ok: true, interview: result.interview })
    } catch (err) {
      next(err)
    }
  })

  router.get('/api/v1/interviews/:interviewId', async (req, res, next) => {
    try {
      const result = await service.get(req.params.interviewId!)
      if (!result.ok) {
        res.status(404).json({ ok: false, error: result.error })
        return
      }
      res.status(200).json({ ok: true, interview: result.interview })
    } catch (err) {
      next(err)
    }
  })

  router.get(
    '/api/v1/interviews/:interviewId/history',
    async (req, res, next) => {
      try {
        const result = await service.history(req.params.interviewId!)
        if (!result.ok) {
          res.status(404).json({ ok: false, error: result.error })
          return
        }
        res.status(200).json({ ok: true, history: result.history })
      } catch (err) {
        next(err)
      }
    },
  )

  router.post(
    '/api/v1/interviews/:interviewId/evaluate',
    async (req, res, next) => {
      try {
        const result = await service.evaluate(
          req.params.interviewId!,
          req.body,
          'evaluated',
        )
        if (!result.ok) {
          const status =
            result.error === 'not_found'
              ? 404
              : result.error === 'validation_error' ||
                  result.error === 'structure_error'
                ? 400
                : result.error === 'attempt_cap' ||
                    result.error === 'already_passed' ||
                    result.error === 'terminal_status'
                  ? 409
                  : 502
          res.status(status).json({
            ok: false,
            error: result.error,
            reason: 'reason' in result ? result.reason : undefined,
            interview: 'interview' in result ? result.interview : undefined,
            details: 'details' in result ? result.details : undefined,
          })
          return
        }
        res.status(200).json({
          ok: true,
          interview: result.interview,
          cached: result.cached,
        })
      } catch (err) {
        next(err)
      }
    },
  )

  router.post(
    '/api/v1/interviews/:interviewId/revise',
    async (req, res, next) => {
      try {
        const result = await service.evaluate(
          req.params.interviewId!,
          req.body,
          'revised',
        )
        if (!result.ok) {
          const status =
            result.error === 'not_found'
              ? 404
              : result.error === 'validation_error' ||
                  result.error === 'structure_error'
                ? 400
                : result.error === 'attempt_cap' ||
                    result.error === 'already_passed' ||
                    result.error === 'terminal_status'
                  ? 409
                  : 502
          res.status(status).json({
            ok: false,
            error: result.error,
            reason: 'reason' in result ? result.reason : undefined,
            interview: 'interview' in result ? result.interview : undefined,
            details: 'details' in result ? result.details : undefined,
          })
          return
        }
        res.status(200).json({
          ok: true,
          interview: result.interview,
          cached: result.cached,
        })
      } catch (err) {
        next(err)
      }
    },
  )

  router.post(
    '/api/v1/interviews/:interviewId/answer',
    async (req, res, next) => {
      try {
        const result = await service.answer(req.params.interviewId!, req.body)
        if (!result.ok) {
          const status =
            result.error === 'not_found'
              ? 404
              : result.error === 'validation_error' ||
                  result.error === 'structure_error'
                ? 400
                : result.error === 'attempt_cap' ||
                    result.error === 'already_passed' ||
                    result.error === 'terminal_status' ||
                    result.error === 'no_pending_follow_up' ||
                    result.error === 'no_architecture'
                  ? 409
                  : 502
          res.status(status).json({
            ok: false,
            error: result.error,
            reason: 'reason' in result ? result.reason : undefined,
            interview: 'interview' in result ? result.interview : undefined,
            details: 'details' in result ? result.details : undefined,
          })
          return
        }
        res.status(200).json({ ok: true, interview: result.interview })
      } catch (err) {
        next(err)
      }
    },
  )

  router.post(
    '/api/v1/interviews/:interviewId/abandon',
    async (req, res, next) => {
      try {
        const result = await service.abandon(req.params.interviewId!)
        if (!result.ok) {
          const status =
            result.error === 'not_found'
              ? 404
              : result.error === 'already_terminal'
                ? 409
                : 400
          res.status(status).json({
            ok: false,
            error: result.error,
            interview: 'interview' in result ? result.interview : undefined,
          })
          return
        }
        res.status(200).json({ ok: true, interview: result.interview })
      } catch (err) {
        next(err)
      }
    },
  )

  return router
}
