import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { loadEnv } from '../config/env.js'
import { createMockGroqAdapter } from '../evaluation/groq/mockAdapter.js'
import { createMemoryInterviewStore } from '../interview/memoryStore.js'

const env = loadEnv({
  NODE_ENV: 'test',
  PORT: '4000',
  RATE_LIMIT_MAX: '1000',
  MAX_EVALUATE_ATTEMPTS: '8',
  MAX_ANSWER_ATTEMPTS: '6',
} as NodeJS.ProcessEnv)

const thinBody = {
  levelId: 'level-1',
  mapId: 'social-media',
  components: [{ id: 's1', kind: 'server', x: 0, y: 0 }],
  connections: [],
  decisions: [],
  explanation: 'thin',
}

describe('interview HTTP API', () => {
  it('start → evaluate → answer flow', async () => {
    const app = createApp(env, {
      interviewStore: createMemoryInterviewStore(),
      llm: createMockGroqAdapter({
        fixedResponse: {
          score: 6,
          summary: 'Needs work',
          strengths: [],
          weaknesses: ['Scaling'],
          followUpQuestion: {
            question: 'How do you scale?',
            reason: 'Load',
            expectedConcepts: ['horizontal scaling'],
          },
          suggestedImprovements: [],
          technologyFeedback: [],
          finalFeedback: null,
        },
      }),
    })

    const start = await request(app)
      .post('/api/v1/interviews/start')
      .send({ levelId: 'level-1', mapId: 'social-media', clientId: 'c1' })
    expect(start.status).toBe(201)
    const id = start.body.interview.id as string

    const evaluated = await request(app)
      .post(`/api/v1/interviews/${id}/evaluate`)
      .send(thinBody)
    expect(evaluated.status).toBe(200)
    expect(evaluated.body.interview.status).toBe('NEEDS_REVISION')

    const answered = await request(app)
      .post(`/api/v1/interviews/${id}/answer`)
      .send({
        answer:
          'I would use horizontal scaling behind a load balancer for the app tier.',
      })
    expect(answered.status).toBe(200)
    expect(answered.body.interview.status).toBe('PASSED')

    const got = await request(app).get(`/api/v1/interviews/${id}`)
    expect(got.status).toBe(200)
    expect(got.body.interview.status).toBe('PASSED')

    const history = await request(app).get(
      `/api/v1/interviews/${id}/history`,
    )
    expect(history.status).toBe(200)
    expect(history.body.history.length).toBeGreaterThanOrEqual(3)
  })
})
