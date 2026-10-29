import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { loadEnv } from '../config/env.js'

describe('GET /health', () => {
  it('returns ok and groq config metadata without leaking secrets', async () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      GROQ_API_KEY: 'gsk_secret_should_not_appear',
      GROQ_MODEL: 'openai/gpt-oss-20b',
      GROQ_MAX_COMPLETION_TOKENS: '800',
    } as NodeJS.ProcessEnv)

    const app = createApp(env)
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.groq.configured).toBe(true)
    expect(res.body.groq.model).toBe('openai/gpt-oss-20b')
    expect(JSON.stringify(res.body)).not.toContain('gsk_secret')
  })
})
