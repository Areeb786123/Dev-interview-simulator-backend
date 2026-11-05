import { describe, it, expect } from 'vitest'
import { createInterviewService } from './service.js'
import { createMemoryInterviewStore } from './memoryStore.js'
import { createMockGroqAdapter } from '../evaluation/groq/mockAdapter.js'

const strongArch = {
  levelId: 'level-1',
  mapId: 'social-media',
  components: [
    { id: 'c1', kind: 'client', x: 0, y: 0 },
    { id: 's1', kind: 'server', x: 40, y: 0 },
    { id: 'p1', kind: 'postgres', x: 80, y: 0 },
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
      advantages: 'Transactions',
      disadvantages: 'Sharding hard',
      alternatives: 'MongoDB',
      bottleneck: 'Primary writes',
    },
    {
      componentId: 's1',
      technology: 'App server',
      whyChosen: 'Handle HTTP and business logic carefully',
      advantages: 'Simple',
      disadvantages: 'Single instance saturates',
      alternatives: 'Serverless',
      bottleneck: 'CPU under load',
    },
  ],
  explanation:
    'Users post through a client to an app server; relational data lands in Postgres with clear transactional write path and read path.',
}

const thinArch = {
  ...strongArch,
  decisions: [],
  explanation: 'ok',
}

describe('interview service state machine', () => {
  it('starts IN_PROGRESS then evaluate below 8 → NEEDS_REVISION with follow-up', async () => {
    const service = createInterviewService({
      store: createMemoryInterviewStore(),
      llm: createMockGroqAdapter({
        fixedResponse: {
          score: 6,
          summary: 'Needs scaling talk',
          strengths: [],
          weaknesses: ['Scaling'],
          followUpQuestion: {
            question: 'How do you handle 10x traffic?',
            reason: 'Single server risk',
            expectedConcepts: ['horizontal scaling', 'load balancing'],
          },
          suggestedImprovements: [],
          technologyFeedback: [],
          finalFeedback: null,
        },
      }),
      limits: { maxEvaluateAttempts: 8, maxAnswerAttempts: 6 },
    })

    const started = await service.start({
      levelId: 'level-1',
      mapId: 'social-media',
      clientId: 'guest-1',
    })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(started.interview.status).toBe('IN_PROGRESS')

    const evaluated = await service.evaluate(
      started.interview.id,
      thinArch,
    )
    expect(evaluated.ok).toBe(true)
    if (!evaluated.ok) return
    expect(evaluated.interview.status).toBe('NEEDS_REVISION')
    expect(evaluated.interview.pendingFollowUp?.question).toMatch(/traffic/i)
    expect(evaluated.interview.tokenUsage.totalTokens).toBeGreaterThan(0)
  })

  it('evaluate at 8+ → PASSED and clears follow-up', async () => {
    const service = createInterviewService({
      store: createMemoryInterviewStore(),
      llm: createMockGroqAdapter({
        fixedResponse: {
          score: 8,
          summary: 'Good enough',
          strengths: ['Path'],
          weaknesses: [],
          followUpQuestion: {
            question: 'should clear',
            reason: 'x',
            expectedConcepts: [],
          },
          suggestedImprovements: [],
          technologyFeedback: [],
          finalFeedback: null,
        },
      }),
      limits: { maxEvaluateAttempts: 8, maxAnswerAttempts: 6 },
    })

    const started = await service.start({
      levelId: 'level-1',
      mapId: 'social-media',
    })
    if (!started.ok) throw new Error('start failed')
    const evaluated = await service.evaluate(started.interview.id, strongArch)
    expect(evaluated.ok).toBe(true)
    if (!evaluated.ok) return
    expect(evaluated.interview.status).toBe('PASSED')
    expect(evaluated.interview.pendingFollowUp).toBeNull()
  })

  it('sandbox evaluate strips follow-up questions', async () => {
    const service = createInterviewService({
      store: createMemoryInterviewStore(),
      llm: createMockGroqAdapter({
        fixedResponse: {
          score: 6,
          summary: 'Needs scaling talk',
          strengths: [],
          weaknesses: ['Scaling'],
          followUpQuestion: {
            question: 'How do you handle 10x traffic?',
            reason: 'Single server risk',
            expectedConcepts: ['horizontal scaling'],
          },
          suggestedImprovements: [],
          technologyFeedback: [],
          finalFeedback: null,
        },
      }),
      limits: { maxEvaluateAttempts: 8, maxAnswerAttempts: 6 },
    })

    const started = await service.start({
      levelId: 'playground',
      mapId: 'sandbox',
    })
    if (!started.ok) throw new Error('start failed')

    const evaluated = await service.evaluate(started.interview.id, {
      ...thinArch,
      levelId: 'playground',
      mapId: 'sandbox',
      components: [
        { id: 'n1', kind: 'custom', x: 10, y: 20, label: 'Auth Gateway' },
      ],
      levelContext: { reviewMode: 'ai', title: 'Custom Design Simulate' },
    })

    expect(evaluated.ok).toBe(true)
    if (!evaluated.ok) return
    expect(evaluated.interview.pendingFollowUp).toBeNull()
    expect(
      evaluated.interview.latestEvaluation?.followUpQuestion,
    ).toBeNull()
  })

  it('answer with expected concepts can transition to PASSED', async () => {
    const service = createInterviewService({
      store: createMemoryInterviewStore(),
      llm: createMockGroqAdapter({
        fixedResponse: {
          score: 6,
          summary: 'Still gaps',
          strengths: [],
          weaknesses: ['Scaling'],
          followUpQuestion: {
            question: 'How do you scale?',
            reason: 'Load',
            expectedConcepts: ['horizontal scaling', 'load balancing'],
          },
          suggestedImprovements: [],
          technologyFeedback: [],
          finalFeedback: null,
        },
      }),
      limits: { maxEvaluateAttempts: 8, maxAnswerAttempts: 6 },
    })

    const started = await service.start({
      levelId: 'level-1',
      mapId: 'social-media',
    })
    if (!started.ok) throw new Error('start failed')
    const evaluated = await service.evaluate(started.interview.id, thinArch)
    if (!evaluated.ok) throw new Error('evaluate failed')

    const answered = await service.answer(evaluated.interview.id, {
      answer:
        'I would add a load balancer and use horizontal scaling with more app servers behind it.',
    })
    expect(answered.ok).toBe(true)
    if (!answered.ok) return
    expect(answered.interview.status).toBe('PASSED')
    expect(answered.interview.latestEvaluation?.score).toBeGreaterThanOrEqual(8)
  })

  it('enforces evaluate attempt caps', async () => {
    const service = createInterviewService({
      store: createMemoryInterviewStore(),
      llm: createMockGroqAdapter({
        fixedResponse: {
          score: 5,
          summary: 'No',
          strengths: [],
          weaknesses: ['x'],
          followUpQuestion: {
            question: 'Why?',
            reason: 'gap',
            expectedConcepts: [],
          },
          suggestedImprovements: [],
          technologyFeedback: [],
          finalFeedback: null,
        },
      }),
      limits: { maxEvaluateAttempts: 1, maxAnswerAttempts: 6 },
    })

    const started = await service.start({
      levelId: 'level-1',
      mapId: 'social-media',
    })
    if (!started.ok) throw new Error('start failed')
    const first = await service.evaluate(started.interview.id, thinArch)
    expect(first.ok).toBe(true)
    const second = await service.evaluate(started.interview.id, thinArch)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.error).toBe('attempt_cap')
    expect(second.interview?.status).toBe('FAILED')
  })

  it('abandon transitions to ABANDONED', async () => {
    const service = createInterviewService({
      store: createMemoryInterviewStore(),
      llm: createMockGroqAdapter(),
      limits: { maxEvaluateAttempts: 8, maxAnswerAttempts: 6 },
    })
    const started = await service.start({
      levelId: 'level-1',
      mapId: 'social-media',
    })
    if (!started.ok) throw new Error('start failed')
    const abandoned = await service.abandon(started.interview.id)
    expect(abandoned.ok).toBe(true)
    if (!abandoned.ok) return
    expect(abandoned.interview.status).toBe('ABANDONED')
  })
})
