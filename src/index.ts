import { createApp, resolveLlm } from './app.js'
import { loadEnv } from './config/env.js'
import { createMemoryInterviewStore } from './interview/memoryStore.js'
import {
  createPostgresInterviewStore,
  createPostgresPool,
} from './interview/postgresStore.js'

async function main() {
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
  const app = createApp(env, { llm, interviewStore })

  const server = app.listen(env.PORT, () => {
    console.log(`[server] listening on :${env.PORT}`)
  })

  function shutdown() {
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[fatal]', err instanceof Error ? err.message : err)
  process.exit(1)
})
