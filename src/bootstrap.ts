import type { Express } from 'express'
import { createApp, resolveLlm } from './app.js'
import { loadEnv } from './config/env.js'
import { createMemoryInterviewStore } from './interview/memoryStore.js'
import {
  createPostgresInterviewStore,
  createPostgresPool,
} from './interview/postgresStore.js'

let appPromise: Promise<Express> | null = null

/** Shared app factory for local listen + Vercel serverless. */
export function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = (async () => {
      const env = loadEnv()

      let interviewStore = createMemoryInterviewStore()
      if (env.databaseConfigured) {
        const pool = await createPostgresPool(env.DATABASE_URL)
        interviewStore = createPostgresInterviewStore(pool)
        console.log('[db] postgres interview store ready')
      } else {
        console.warn(
          '[db] DATABASE_URL not set — using in-memory interview store',
        )
      }

      if (!env.groqConfigured) {
        console.warn(
          '[config] GROQ_API_KEY not set — using mock Groq adapter (offline)',
        )
      } else {
        console.log(`[config] Groq model=${env.GROQ_MODEL}`)
      }

      const llm = resolveLlm(env)
      return createApp(env, { llm, interviewStore })
    })()
  }
  return appPromise
}
