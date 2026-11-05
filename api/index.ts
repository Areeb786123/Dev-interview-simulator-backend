import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getApp } from '../src/bootstrap.js'

/**
 * Vercel serverless entry.
 * Import from `src/` so the function bundler includes the app (not only dist/).
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const app = await getApp()
  await new Promise<void>((resolve) => {
    // Express handles the Node req/res pair; settle when response finishes.
    res.on('finish', resolve)
    app(req as never, res as never)
  })
}
