import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { evaluateArchitecture } from '../evaluation/service.js'
import type { LlmEvaluator } from '../evaluation/groq/types.js'
import {
  ArchitectureSubmitSchema,
  type ArchitectureSubmit,
} from '../evaluation/schemas.js'
import type { InterviewStore } from './store.js'
import {
  addUsage,
  emptyTokenUsage,
  estimateTokensFromText,
} from './tokenUsage.js'
import {
  canEvaluateStatus,
  isTerminalStatus,
  type InterviewEvent,
  type InterviewLimits,
  type InterviewRecord,
  type InterviewStatus,
} from './types.js'

const StartSchema = z.object({
  levelId: z.string().min(1),
  mapId: z.string().min(1),
  clientId: z.string().min(1).optional(),
})

const AnswerSchema = z.object({
  answer: z.string().min(1).max(8000),
})

function nowIso() {
  return new Date().toISOString()
}

function pushEvent(
  interview: InterviewRecord,
  event: Omit<InterviewEvent, 'id' | 'at'>,
): void {
  interview.history.push({
    id: randomUUID(),
    at: nowIso(),
    ...event,
  })
}

function statusFromScore(passed: boolean): InterviewStatus {
  return passed ? 'PASSED' : 'NEEDS_REVISION'
}

function resolveUsage(
  provider: { promptTokens: number; completionTokens: number } | undefined,
  fallbackPrompt: string,
  fallbackCompletion: string,
) {
  if (provider) return provider
  return {
    promptTokens: estimateTokensFromText(fallbackPrompt),
    completionTokens: estimateTokensFromText(fallbackCompletion),
  }
}

export type InterviewServiceDeps = {
  store: InterviewStore
  llm?: LlmEvaluator
  limits: InterviewLimits
}

export function createInterviewService(deps: InterviewServiceDeps) {
  const { store, llm, limits } = deps

  return {
    async start(input: unknown) {
      const parsed = StartSchema.safeParse(input)
      if (!parsed.success) {
        return {
          ok: false as const,
          error: 'validation_error' as const,
          details: parsed.error.flatten(),
        }
      }

      const createdAt = nowIso()
      const record: InterviewRecord = {
        id: randomUUID(),
        clientId: parsed.data.clientId ?? randomUUID(),
        levelId: parsed.data.levelId,
        mapId: parsed.data.mapId,
        status: 'IN_PROGRESS',
        evaluateAttempts: 0,
        answerAttempts: 0,
        createdAt,
        updatedAt: createdAt,
        latestArchitecture: null,
        latestEvaluation: null,
        pendingFollowUp: null,
        history: [],
        tokenUsage: emptyTokenUsage(),
      }
      pushEvent(record, {
        type: 'started',
        summary: `Interview started for ${record.levelId}`,
        status: 'IN_PROGRESS',
      })
      await store.create(record)
      return { ok: true as const, interview: record }
    },

    async get(id: string) {
      const interview = await store.get(id)
      if (!interview) {
        return { ok: false as const, error: 'not_found' as const }
      }
      return { ok: true as const, interview }
    },

    async history(id: string) {
      const interview = await store.get(id)
      if (!interview) {
        return { ok: false as const, error: 'not_found' as const }
      }
      return { ok: true as const, history: interview.history }
    },

    async abandon(id: string) {
      const interview = await store.get(id)
      if (!interview) {
        return { ok: false as const, error: 'not_found' as const }
      }
      if (isTerminalStatus(interview.status)) {
        return {
          ok: false as const,
          error: 'already_terminal' as const,
          interview,
        }
      }
      interview.status = 'ABANDONED'
      interview.pendingFollowUp = null
      interview.updatedAt = nowIso()
      pushEvent(interview, {
        type: 'abandoned',
        summary: 'Interview abandoned by client',
        status: 'ABANDONED',
      })
      await store.update(interview)
      return { ok: true as const, interview }
    },

    async evaluate(
      id: string,
      input: unknown,
      kind: 'evaluated' | 'revised' = 'evaluated',
    ) {
      const interview = await store.get(id)
      if (!interview) {
        return { ok: false as const, error: 'not_found' as const }
      }
      if (!canEvaluateStatus(interview.status)) {
        return {
          ok: false as const,
          error:
            interview.status === 'PASSED'
              ? ('already_passed' as const)
              : ('terminal_status' as const),
          interview,
        }
      }
      if (interview.evaluateAttempts >= limits.maxEvaluateAttempts) {
        interview.status = 'FAILED'
        interview.pendingFollowUp = null
        pushEvent(interview, {
          type: 'failed',
          summary: 'Evaluate attempt cap reached',
          status: 'FAILED',
        })
        interview.updatedAt = nowIso()
        await store.update(interview)
        return {
          ok: false as const,
          error: 'attempt_cap' as const,
          interview,
        }
      }

      const parsed = ArchitectureSubmitSchema.safeParse(input)
      if (!parsed.success) {
        return {
          ok: false as const,
          error: 'validation_error' as const,
          details: parsed.error.flatten(),
        }
      }

      const submit: ArchitectureSubmit = {
        ...parsed.data,
        levelId: interview.levelId,
        mapId: interview.mapId,
      }

      const evalResult = await evaluateArchitecture(submit, { llm })
      if (!evalResult.ok) {
        return {
          ok: false as const,
          error: evalResult.error,
          details: 'details' in evalResult ? evalResult.details : undefined,
          reason: 'reason' in evalResult ? evalResult.reason : undefined,
        }
      }

      const usage = resolveUsage(
        evalResult.usage,
        JSON.stringify(submit),
        JSON.stringify(evalResult.evaluation),
      )

      interview.evaluateAttempts += 1
      interview.latestArchitecture = submit
      interview.latestEvaluation = evalResult.evaluation
      interview.pendingFollowUp = evalResult.evaluation.followUpQuestion
      interview.status = statusFromScore(evalResult.evaluation.passed)
      interview.tokenUsage = addUsage(
        interview.tokenUsage,
        usage.promptTokens,
        usage.completionTokens,
      )
      interview.updatedAt = nowIso()
      pushEvent(interview, {
        type: kind,
        summary: evalResult.cached
          ? `${evalResult.evaluation.summary} (cached)`
          : evalResult.evaluation.summary,
        score: evalResult.evaluation.score,
        status: interview.status,
      })
      if (interview.status === 'PASSED') {
        pushEvent(interview, {
          type: 'passed',
          summary: 'Interview passed',
          score: evalResult.evaluation.score,
          status: 'PASSED',
        })
      }
      await store.update(interview)
      return { ok: true as const, interview, cached: evalResult.cached ?? false }
    },

    async answer(id: string, input: unknown) {
      const interview = await store.get(id)
      if (!interview) {
        return { ok: false as const, error: 'not_found' as const }
      }
      if (!canEvaluateStatus(interview.status)) {
        return {
          ok: false as const,
          error:
            interview.status === 'PASSED'
              ? ('already_passed' as const)
              : ('terminal_status' as const),
          interview,
        }
      }
      if (interview.status !== 'NEEDS_REVISION' || !interview.pendingFollowUp) {
        return {
          ok: false as const,
          error: 'no_pending_follow_up' as const,
          interview,
        }
      }
      if (interview.answerAttempts >= limits.maxAnswerAttempts) {
        interview.status = 'FAILED'
        interview.pendingFollowUp = null
        pushEvent(interview, {
          type: 'failed',
          summary: 'Answer attempt cap reached',
          status: 'FAILED',
        })
        interview.updatedAt = nowIso()
        await store.update(interview)
        return {
          ok: false as const,
          error: 'attempt_cap' as const,
          interview,
        }
      }

      const parsed = AnswerSchema.safeParse(input)
      if (!parsed.success) {
        return {
          ok: false as const,
          error: 'validation_error' as const,
          details: parsed.error.flatten(),
        }
      }

      if (!interview.latestArchitecture) {
        return {
          ok: false as const,
          error: 'no_architecture' as const,
          interview,
        }
      }

      const followUp = interview.pendingFollowUp
      const enriched: ArchitectureSubmit = {
        ...interview.latestArchitecture,
        explanation: [
          interview.latestArchitecture.explanation,
          '',
          `Follow-up: ${followUp.question}`,
          `Candidate answer: ${parsed.data.answer}`,
        ].join('\n'),
      }

      const evalResult = await evaluateArchitecture(enriched, { llm })
      if (!evalResult.ok) {
        return {
          ok: false as const,
          error: evalResult.error,
          details: 'details' in evalResult ? evalResult.details : undefined,
          reason: 'reason' in evalResult ? evalResult.reason : undefined,
        }
      }

      let evaluation = evalResult.evaluation
      const answerLower = parsed.data.answer.toLowerCase()
      const hitConcepts = followUp.expectedConcepts.filter((c) =>
        answerLower.includes(c.toLowerCase()),
      )
      if (
        !evaluation.passed &&
        parsed.data.answer.trim().length >= 40 &&
        hitConcepts.length > 0
      ) {
        const boosted = Math.min(10, evaluation.score + 2)
        evaluation = {
          ...evaluation,
          score: boosted,
          passed: boosted >= 8,
          summary:
            boosted >= 8
              ? 'Follow-up answer addressed the key gap.'
              : evaluation.summary,
          followUpQuestion: boosted >= 8 ? null : evaluation.followUpQuestion,
          finalFeedback:
            boosted >= 8
              ? 'Congratulations — your follow-up reasoning meets the bar.'
              : null,
        }
      }

      const usage = resolveUsage(
        evalResult.usage,
        enriched.explanation + followUp.question,
        JSON.stringify(evaluation),
      )

      interview.answerAttempts += 1
      interview.latestEvaluation = evaluation
      interview.pendingFollowUp = evaluation.followUpQuestion
      interview.status = statusFromScore(evaluation.passed)
      interview.tokenUsage = addUsage(
        interview.tokenUsage,
        usage.promptTokens,
        usage.completionTokens,
      )
      interview.updatedAt = nowIso()
      pushEvent(interview, {
        type: 'answered',
        summary: evaluation.summary,
        score: evaluation.score,
        status: interview.status,
      })
      if (interview.status === 'PASSED') {
        pushEvent(interview, {
          type: 'passed',
          summary: 'Interview passed after follow-up',
          score: evaluation.score,
          status: 'PASSED',
        })
      }
      await store.update(interview)
      return { ok: true as const, interview }
    },
  }
}

export type InterviewService = ReturnType<typeof createInterviewService>
