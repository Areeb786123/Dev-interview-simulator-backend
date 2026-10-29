import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { loadEnv } from '../config/env.js'
import { createMockGroqAdapter } from '../evaluation/groq/mockAdapter.js'

const env = loadEnv({
  NODE_ENV: 'test',
  PORT: '4000',
} as NodeJS.ProcessEnv)

const body = {
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
      whyChosen: 'Relational posts need transactions',
      advantages: 'ACID',
      disadvantages: 'Sharding complexity',
      alternatives: 'MongoDB',
      bottleneck: 'Primary writes',
    },
  ],
  explanation:
    'Client → server → Postgres for durable post storage with transactional writes.',
  levelContext: {
    title: 'First Post',
    question: 'Persist and read a post.',
  },
}

describe('POST /api/v1/evaluate', () => {
  it('returns 200 with score, passed, and feedback fields', async () => {
    const app = createApp(env, {
      llm: createMockGroqAdapter({
        fixedResponse: {
          score: 8,
          summary: 'Meets the bar.',
          strengths: ['Clear data path'],
          weaknesses: ['Monitoring light'],
          followUpQuestion: null,
          suggestedImprovements: [],
          technologyFeedback: [
            {
              technology: 'Postgres',
              decision: 'reasonable',
              reason: 'Fits relational needs.',
            },
          ],
          finalFeedback: 'Nice work on this level.',
        },
      }),
    })

    const res = await request(app).post('/api/v1/evaluate').send(body)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.evaluation.score).toBe(8)
    expect(res.body.evaluation.passed).toBe(true)
    expect(res.body.evaluation.followUpQuestion).toBeNull()
    expect(res.body.evaluation.strengths).toContain('Clear data path')
  })

  it('returns 400 for empty architecture', async () => {
    const app = createApp(env, { llm: createMockGroqAdapter() })
    const res = await request(app)
      .post('/api/v1/evaluate')
      .send({ ...body, components: [] })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
  })
})
