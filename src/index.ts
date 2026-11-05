import { getApp } from './bootstrap.js'
import { loadEnv } from './config/env.js'

async function main() {
  // On Vercel the serverless entry (api/index.ts) serves the app — do not listen.
  if (process.env.VERCEL) {
    await getApp()
    return
  }

  const env = loadEnv()
  const app = await getApp()
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
