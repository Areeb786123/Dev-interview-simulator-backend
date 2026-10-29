import { describe, it, expect } from 'vitest'
import { createEvalCache, hashEvaluationContext } from './cache.js'

describe('eval cache', () => {
  it('hashes stable JSON and returns cached evaluation', () => {
    const cache = createEvalCache()
    const key = hashEvaluationContext({ a: 1, b: 'x' })
    expect(key).toHaveLength(64)
    cache.set(key, {
      evaluation: {
        score: 8,
        passed: true,
        summary: 'ok',
        strengths: [],
        weaknesses: [],
        followUpQuestion: null,
        suggestedImprovements: [],
        technologyFeedback: [],
        finalFeedback: 'done',
      },
    })
    expect(cache.get(key)?.evaluation.score).toBe(8)
    expect(cache.get(hashEvaluationContext({ a: 2 }))).toBeUndefined()
  })
})
