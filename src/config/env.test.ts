import { describe, it, expect } from 'vitest'
import { loadEnv } from './env.js'

describe('loadEnv', () => {
  it('applies defaults for model and tokens', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      PORT: '4123',
    } as NodeJS.ProcessEnv)

    expect(env.PORT).toBe(4123)
    expect(env.GROQ_MODEL).toBe('openai/gpt-oss-20b')
    expect(env.GROQ_MAX_COMPLETION_TOKENS).toBe(1600)
    expect(env.groqConfigured).toBe(false)
  })

  it('marks groq configured when a real-looking key is present', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      GROQ_API_KEY: 'gsk_test_not_a_real_key',
    } as NodeJS.ProcessEnv)

    expect(env.groqConfigured).toBe(true)
  })

  it('rejects placeholder as configured', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      GROQ_API_KEY: 'your_new_groq_api_key',
    } as NodeJS.ProcessEnv)

    expect(env.groqConfigured).toBe(false)
  })

  it('rejects invalid PORT', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'test',
        PORT: '-1',
      } as NodeJS.ProcessEnv),
    ).toThrow(/Invalid environment/)
  })
})
