import type { ArchitectureSubmit, LlmEvaluation } from '../schemas.js'
import type {
  EvaluationContext,
  LlmCallResult,
  LlmEvaluator,
} from './types.js'

export type MockGroqOptions = {
  /** Deterministic override — used by unit/integration tests. */
  fixedResponse?: LlmEvaluation
}

function heuristicScore(submit: ArchitectureSubmit): number {
  let score = 4

  const kinds = new Set(submit.components.map((c) => c.kind))
  if (kinds.has('server') || kinds.has('load-balancer')) score += 1
  if (kinds.has('postgres') || kinds.has('mongodb') || kinds.has('redis')) {
    score += 1
  }
  if (submit.connections.length > 0) score += 1

  const explanationLen = submit.explanation.trim().length
  if (explanationLen >= 40) score += 1
  if (explanationLen >= 120) score += 1

  const decided = submit.decisions.filter(
    (d) => d.whyChosen.trim().length >= 8,
  ).length
  if (decided >= 1) score += 1
  if (decided >= 2) score += 1

  const hasTradeoffs = submit.decisions.some(
    (d) =>
      d.advantages.trim().length > 0 && d.disadvantages.trim().length > 0,
  )
  if (hasTradeoffs) score += 1

  return Math.min(10, Math.max(1, score))
}

function buildHeuristicEvaluation(
  submit: ArchitectureSubmit,
): LlmEvaluation {
  const score = heuristicScore(submit)
  const kinds = [...new Set(submit.components.map((c) => c.kind))]

  const strengths: string[] = []
  const weaknesses: string[] = []

  if (submit.connections.length > 0) {
    strengths.push('Components are connected rather than isolated.')
  } else {
    weaknesses.push('No connections between components.')
  }

  if (submit.decisions.some((d) => d.whyChosen.trim().length >= 8)) {
    strengths.push('At least one technology choice is justified.')
  } else {
    weaknesses.push('Technology decisions lack written justification.')
  }

  if (submit.explanation.trim().length < 40) {
    weaknesses.push('Overall explanation is too thin for an interview.')
  } else {
    strengths.push('Provides an overall design narrative.')
  }

  if (!kinds.some((k) => k === 'postgres' || k === 'mongodb' || k === 'redis')) {
    weaknesses.push('No durable or cache storage component is present.')
  }

  const followUpQuestion =
    score >= 8
      ? null
      : {
          question:
            'What is the main bottleneck in this design under 10× traffic, and how would you address it?',
          reason:
            'The current score is below the pass threshold; scaling reasoning needs more depth.',
          expectedConcepts: [
            'horizontal scaling',
            'load balancing',
            'caching',
            'cost vs complexity',
          ],
        }

  return {
    score,
    summary:
      score >= 8
        ? 'The design and reasoning meet the bar for this challenge.'
        : 'The design is a start, but important interview gaps remain.',
    strengths,
    weaknesses,
    followUpQuestion,
    suggestedImprovements:
      score >= 8
        ? [
            {
              title: 'Optional: observability',
              description:
                'Consider metrics and failure recovery for production readiness.',
              priority: 'low' as const,
            },
          ]
        : [
            {
              title: 'Strengthen trade-off discussion',
              description:
                'Explain why each major technology was chosen and what you rejected.',
              priority: 'high' as const,
            },
          ],
    technologyFeedback: submit.decisions.slice(0, 5).map((d) => ({
      technology: d.technology,
      decision: 'reasonable' as const,
      reason:
        d.whyChosen.trim().length > 0
          ? d.whyChosen.slice(0, 200)
          : 'No written rationale supplied.',
    })),
    finalFeedback:
      score >= 8
        ? 'Congratulations — this design meets the bar for this level.'
        : null,
  }
}

/**
 * Offline Groq stand-in for Phase 3. No network, no API key.
 * Real SDK adapter replaces this when Groq is wired.
 */
export function createMockGroqAdapter(
  options: MockGroqOptions = {},
): LlmEvaluator {
  return {
    async evaluate(ctx: EvaluationContext): Promise<LlmCallResult> {
      const evaluation = options.fixedResponse
        ? options.fixedResponse
        : buildHeuristicEvaluation(ctx.submit)
      return {
        evaluation,
        usage: {
          promptTokens: Math.ceil(JSON.stringify(ctx.submit).length / 4),
          completionTokens: Math.ceil(JSON.stringify(evaluation).length / 4),
        },
      }
    },
  }
}
