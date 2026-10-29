import { describe, it, expect } from 'vitest'
import { createMockGroqAdapter } from './mockAdapter.js'
import type { ArchitectureSubmit } from '../schemas.js'
import { LlmEvaluationSchema } from '../schemas.js'

const baseSubmit: ArchitectureSubmit = {
  levelId: 'level-1',
  mapId: 'social-media',
  components: [
    { id: 'c1', kind: 'client', x: 0, y: 0 },
    { id: 's1', kind: 'server', x: 100, y: 0 },
    { id: 'p1', kind: 'postgres', x: 200, y: 0 },
  ],
  connections: [
    { id: 'e1', from: 'c1', to: 's1' },
    { id: 'e2', from: 's1', to: 'p1' },
  ],
  decisions: [
    {
      componentId: 'p1',
      technology: 'Postgres',
      whyChosen: 'Relational consistency for posts',
      advantages: 'ACID',
      disadvantages: 'Harder horizontal scale',
      alternatives: 'MongoDB',
      bottleneck: 'Write amplification',
    },
  ],
  explanation:
    'Clients hit an app server; posts persist in Postgres with transactional writes.',
}

describe('createMockGroqAdapter', () => {
  it('returns schema-valid evaluation without calling a network API', async () => {
    const llm = createMockGroqAdapter()
    const raw = await llm.evaluate({
      submit: baseSubmit,
      rubricPrompt: 'Score 1-10',
    })
    const parsed = LlmEvaluationSchema.safeParse(raw.evaluation)
    expect(parsed.success).toBe(true)
    expect(raw.usage?.promptTokens).toBeGreaterThan(0)
  })

  it('scores stronger reasoned designs higher than thin ones', async () => {
    const llm = createMockGroqAdapter()
    const strong = await llm.evaluate({
      submit: baseSubmit,
      rubricPrompt: 'x',
    })
    const thin = await llm.evaluate({
      submit: {
        ...baseSubmit,
        decisions: [],
        explanation: 'ok',
      },
      rubricPrompt: 'x',
    })
    expect(strong.evaluation.score).toBeGreaterThan(thin.evaluation.score)
  })

  it('honors a fixed response override for tests', async () => {
    const llm = createMockGroqAdapter({
      fixedResponse: {
        score: 9,
        summary: 'Fixed pass',
        strengths: ['Clear path'],
        weaknesses: [],
        followUpQuestion: null,
        suggestedImprovements: [],
        technologyFeedback: [],
        finalFeedback: 'Great work',
      },
    })
    const raw = await llm.evaluate({
      submit: baseSubmit,
      rubricPrompt: 'x',
    })
    expect(raw.evaluation.score).toBe(9)
    expect(raw.evaluation.summary).toBe('Fixed pass')
  })
})
