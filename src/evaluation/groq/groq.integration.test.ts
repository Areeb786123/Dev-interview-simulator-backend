import { describe, it, expect } from 'vitest'
import { createGroqAdapter } from './groqAdapter.js'

/**
 * Optional live Groq smoke test.
 * Run only when GROQ_LIVE_TEST=1 and GROQ_API_KEY is a real key.
 *
 *   GROQ_LIVE_TEST=1 GROQ_API_KEY=gsk_... npm test -- src/evaluation/groq/groq.integration.test.ts
 */
const runLive =
  process.env.GROQ_LIVE_TEST === '1' &&
  Boolean(process.env.GROQ_API_KEY) &&
  process.env.GROQ_API_KEY !== 'your_new_groq_api_key'

describe.skipIf(!runLive)('Groq live integration', () => {
  it(
    'returns schema-valid JSON for a tiny architecture',
    async () => {
      const llm = createGroqAdapter({
        apiKey: process.env.GROQ_API_KEY!,
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        maxCompletionTokens: 400,
        timeoutMs: 40_000,
        maxRetries: 1,
      })

      const result = await llm.evaluate({
        rubricPrompt:
          'Score 1-10. Return JSON with score, summary, strengths, weaknesses, followUpQuestion, suggestedImprovements, technologyFeedback, finalFeedback.',
        submit: {
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
              whyChosen: 'Need ACID for posts',
              advantages: 'Transactions',
              disadvantages: 'Harder to shard',
              alternatives: 'MongoDB',
              bottleneck: 'Primary writes',
            },
          ],
          explanation:
            'Client posts through an app server into Postgres with transactional writes.',
        },
      })

      expect(result.evaluation.score).toBeGreaterThanOrEqual(1)
      expect(result.evaluation.score).toBeLessThanOrEqual(10)
      expect(result.evaluation.summary.length).toBeGreaterThan(5)
    },
    60_000,
  )
})
