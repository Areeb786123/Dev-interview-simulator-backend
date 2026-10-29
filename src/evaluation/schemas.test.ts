import { describe, it, expect } from 'vitest'
import {
  ArchitectureSubmitSchema,
  LlmEvaluationSchema,
  PASS_THRESHOLD,
  normalizeEvaluation,
  parseLlmEvaluation,
} from './schemas.js'

const validSubmit = {
  levelId: 'level-1',
  mapId: 'social-media',
  components: [{ id: 'n1', kind: 'server', x: 10, y: 20 }],
  connections: [{ id: 'e1', from: 'n1', to: 'n2' }],
  decisions: [
    {
      componentId: 'n1',
      technology: 'Node.js',
      whyChosen: 'Familiar runtime',
      advantages: 'Fast iteration',
      disadvantages: 'Single-threaded CPU',
      alternatives: 'Go',
      bottleneck: 'CPU-bound work',
    },
  ],
  explanation: 'Client talks to an app server backed by Postgres.',
}

describe('ArchitectureSubmitSchema', () => {
  it('accepts a well-formed architecture submit', () => {
    const parsed = ArchitectureSubmitSchema.safeParse(validSubmit)
    expect(parsed.success).toBe(true)
  })

  it('rejects empty components', () => {
    const parsed = ArchitectureSubmitSchema.safeParse({
      ...validSubmit,
      components: [],
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects missing explanation', () => {
    const { explanation: _, ...rest } = validSubmit
    const parsed = ArchitectureSubmitSchema.safeParse(rest)
    expect(parsed.success).toBe(false)
  })
})

describe('LlmEvaluationSchema', () => {
  it('accepts a structured evaluation payload', () => {
    const parsed = LlmEvaluationSchema.safeParse({
      score: 6,
      summary: 'Needs scaling discussion.',
      strengths: ['Clear app/db split'],
      weaknesses: ['No scaling plan'],
      followUpQuestion: {
        question: 'How would you handle 10x traffic?',
        reason: 'Single server may saturate.',
        expectedConcepts: ['horizontal scaling', 'load balancing'],
      },
      suggestedImprovements: [
        {
          title: 'Add load balancer',
          description: 'Distribute traffic across app instances.',
          priority: 'high',
        },
      ],
      technologyFeedback: [
        {
          technology: 'Postgres',
          decision: 'reasonable',
          reason: 'Fits relational account data.',
        },
      ],
      finalFeedback: null,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects score outside 1–10', () => {
    const parsed = LlmEvaluationSchema.safeParse({
      score: 11,
      summary: 'x',
      strengths: [],
      weaknesses: [],
      followUpQuestion: null,
      suggestedImprovements: [],
      technologyFeedback: [],
      finalFeedback: null,
    })
    expect(parsed.success).toBe(false)
  })

  it('parseLlmEvaluation coerces common LLM quirks', () => {
    const parsed = parseLlmEvaluation({
      evaluation: {
        score: '7.4',
        summary: 'Gaps remain',
        strengths: 'Clear path',
        weaknesses: ['No cache'],
        followUp: {
          question: 'How do you scale reads?',
          why: 'Single DB',
          concepts: ['replicas'],
        },
        improvements: ['Add Redis'],
        techFeedback: [
          {
            tech: 'Postgres',
            rating: 'Good',
            why: 'Fits relational data',
          },
        ],
        finalFeedback: false,
      },
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.score).toBe(7)
    expect(parsed.data.strengths).toEqual(['Clear path'])
    expect(parsed.data.followUpQuestion?.question).toContain('scale')
    expect(parsed.data.suggestedImprovements[0]?.title).toBe('Add Redis')
    expect(parsed.data.technologyFeedback[0]?.decision).toBe('reasonable')
    expect(parsed.data.finalFeedback).toBeNull()
  })
})

describe('normalizeEvaluation', () => {
  it(`sets passed true when score >= ${PASS_THRESHOLD} and clears follow-up`, () => {
    const result = normalizeEvaluation({
      score: 8,
      summary: 'Solid for this level.',
      strengths: ['Good reasoning'],
      weaknesses: ['Monitoring missing'],
      followUpQuestion: {
        question: 'Should not remain',
        reason: 'x',
        expectedConcepts: [],
      },
      suggestedImprovements: [],
      technologyFeedback: [],
      finalFeedback: null,
    })
    expect(result.passed).toBe(true)
    expect(result.score).toBe(8)
    expect(result.followUpQuestion).toBeNull()
  })

  it(`sets passed false when score < ${PASS_THRESHOLD} even if model claimed pass`, () => {
    const result = normalizeEvaluation({
      score: 6,
      summary: 'Gaps remain.',
      strengths: [],
      weaknesses: ['Scaling'],
      followUpQuestion: {
        question: 'How do you scale?',
        reason: 'Traffic growth',
        expectedConcepts: ['horizontal scaling'],
      },
      suggestedImprovements: [],
      technologyFeedback: [],
      finalFeedback: 'You passed!',
    })
    expect(result.passed).toBe(false)
    expect(result.followUpQuestion?.question).toBe('How do you scale?')
    expect(result.finalFeedback).toBeNull()
  })
})
