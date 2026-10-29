import { describe, it, expect, vi } from 'vitest'
import { evaluateArchitecture } from './service.js'
import { createEvalCache } from './cache.js'
import { createMockGroqAdapter } from './groq/mockAdapter.js'
import type { LlmEvaluator } from './groq/types.js'
import type { ArchitectureSubmit } from './schemas.js'

function freshOpts(llm: LlmEvaluator) {
  return { llm, cache: createEvalCache() }
}

const goodSubmit: ArchitectureSubmit = {
  levelId: 'level-1',
  mapId: 'social-media',
  components: [
    { id: 'c1', kind: 'client', x: 0, y: 0 },
    { id: 's1', kind: 'server', x: 80, y: 0 },
    { id: 'p1', kind: 'postgres', x: 160, y: 0 },
  ],
  connections: [
    { id: 'e1', from: 'c1', to: 's1' },
    { id: 'e2', from: 's1', to: 'p1' },
  ],
  decisions: [
    {
      componentId: 'p1',
      technology: 'Postgres',
      whyChosen: 'Need ACID for posts and users',
      advantages: 'Transactions and joins',
      disadvantages: 'Harder to shard',
      alternatives: 'MongoDB',
      bottleneck: 'Primary write path',
    },
    {
      componentId: 's1',
      technology: 'App server',
      whyChosen: 'Handle HTTP and business logic',
      advantages: 'Simple to start',
      disadvantages: 'Single instance saturates',
      alternatives: 'Serverless functions',
      bottleneck: 'CPU under load',
    },
  ],
  explanation:
    'Users post through a client to an app server; relational data lands in Postgres with clear write path.',
  levelContext: {
    title: 'First Post',
    question: 'Persist a post and serve a read.',
  },
}

describe('evaluateArchitecture', () => {
  it('returns normalized evaluation via injected LLM', async () => {
    const llm = createMockGroqAdapter({
      fixedResponse: {
        score: 9,
        summary: 'Strong path and trade-offs.',
        strengths: ['Clear client→server→db path'],
        weaknesses: ['Monitoring not discussed'],
        followUpQuestion: {
          question: 'should be cleared',
          reason: 'n/a',
          expectedConcepts: [],
        },
        suggestedImprovements: [],
        technologyFeedback: [],
        finalFeedback: null,
      },
    })

    const result = await evaluateArchitecture(goodSubmit, freshOpts(llm))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.evaluation.score).toBe(9)
    expect(result.evaluation.passed).toBe(true)
    expect(result.evaluation.followUpQuestion).toBeNull()
  })

  it('rejects invalid submit before calling LLM', async () => {
    const evaluate = vi.fn()
    const llm: LlmEvaluator = { evaluate }

    const result = await evaluateArchitecture(
      { ...goodSubmit, components: [] },
      freshOpts(llm),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('validation_error')
    expect(evaluate).not.toHaveBeenCalled()
  })

  it('fails closed when LLM returns invalid JSON shape', async () => {
    const llm: LlmEvaluator = {
      evaluate: async () =>
        ({ evaluation: { score: 99, summary: 'bad' } }) as never,
    }

    const result = await evaluateArchitecture(goodSubmit, freshOpts(llm))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('llm_invalid_response')
  })

  it('rejects structurally broken graphs before calling LLM', async () => {
    const evaluate = vi.fn()
    const llm: LlmEvaluator = { evaluate }
    const result = await evaluateArchitecture(
      {
        ...goodSubmit,
        connections: [],
        explanation: 'two boxes with no wires',
      },
      freshOpts(llm),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('structure_error')
    expect(evaluate).not.toHaveBeenCalled()
  })

  it('returns cached evaluation for identical context', async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValue({
        evaluation: {
          score: 8,
          summary: 'ok',
          strengths: [],
          weaknesses: [],
          followUpQuestion: null,
          suggestedImprovements: [],
          technologyFeedback: [],
          finalFeedback: 'done',
        },
        usage: { promptTokens: 10, completionTokens: 5 },
      })
    const llm: LlmEvaluator = { evaluate }
    const cache = createEvalCache()

    const first = await evaluateArchitecture(goodSubmit, { llm, cache })
    const second = await evaluateArchitecture(goodSubmit, { llm, cache })
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
    expect(evaluate).toHaveBeenCalledTimes(1)
  })


  it('enforces pass=false below threshold despite model claims', async () => {
    const llm = createMockGroqAdapter({
      fixedResponse: {
        score: 6,
        summary: 'Gaps remain.',
        strengths: [],
        weaknesses: ['Scaling'],
        followUpQuestion: {
          question: 'How do you scale the app tier?',
          reason: 'Single server risk',
          expectedConcepts: ['horizontal scaling'],
        },
        suggestedImprovements: [],
        technologyFeedback: [],
        finalFeedback: 'You passed somehow',
      },
    })

    const result = await evaluateArchitecture(goodSubmit, freshOpts(llm))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.evaluation.passed).toBe(false)
    expect(result.evaluation.finalFeedback).toBeNull()
    expect(result.evaluation.followUpQuestion?.question).toMatch(/scale/i)
  })
})
