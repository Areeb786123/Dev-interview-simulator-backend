import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getApp } from '../dist/bootstrap.js'

/**
 * Vercel serverless entry — Express app as request listener.
 * Build (`tsc`) must run first so `dist/` exists.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp()
  app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1])
}
