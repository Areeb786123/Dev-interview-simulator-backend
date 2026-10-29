import { createHash } from 'node:crypto'
import type { EvaluationResult } from './schemas.js'

export type EvalCacheEntry = {
  evaluation: EvaluationResult
  usage?: { promptTokens: number; completionTokens: number }
  at: number
}

export type EvalCache = {
  get(key: string): EvalCacheEntry | undefined
  set(key: string, entry: Omit<EvalCacheEntry, 'at'>): void
  clear(): void
}

/** In-memory hash cache — Redis only if multi-instance sharing is needed later. */
export function createEvalCache(options?: {
  ttlMs?: number
  maxEntries?: number
}): EvalCache {
  const ttlMs = options?.ttlMs ?? 30 * 60 * 1000
  const maxEntries = options?.maxEntries ?? 200
  const map = new Map<string, EvalCacheEntry>()

  return {
    get(key) {
      const hit = map.get(key)
      if (!hit) return undefined
      if (Date.now() - hit.at > ttlMs) {
        map.delete(key)
        return undefined
      }
      return hit
    },
    set(key, entry) {
      if (map.size >= maxEntries) {
        const oldest = map.keys().next().value
        if (oldest) map.delete(oldest)
      }
      map.set(key, { ...entry, at: Date.now() })
    },
    clear() {
      map.clear()
    },
  }
}

export function hashEvaluationContext(payload: unknown): string {
  const json = JSON.stringify(payload)
  return createHash('sha256').update(json).digest('hex')
}
