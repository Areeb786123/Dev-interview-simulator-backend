import { describe, it, expect } from 'vitest'
import {
  SCORE_BANDS,
  PASS_THRESHOLD,
  buildRubricPrompt,
  describeScoreBand,
} from './rubric.js'

describe('scoring rubric', () => {
  it('documents bands covering 1–10 with pass at 8+', () => {
    expect(PASS_THRESHOLD).toBe(8)
    expect(SCORE_BANDS.length).toBeGreaterThanOrEqual(5)
    expect(describeScoreBand(2)).toMatch(/major/i)
    expect(describeScoreBand(8)).toMatch(/acceptable/i)
    expect(describeScoreBand(10)).toMatch(/excellent/i)
  })

  it('builds a concise rubric prompt mentioning dimensions and threshold', () => {
    const prompt = buildRubricPrompt({
      title: 'First Post',
      question: 'Store a post and serve a read.',
    })
    expect(prompt).toContain('1-10')
    expect(prompt).toContain(String(PASS_THRESHOLD))
    expect(prompt).toMatch(/requirement coverage/i)
    expect(prompt).toMatch(/technology trade-offs/i)
    expect(prompt).toContain('First Post')
  })
})
