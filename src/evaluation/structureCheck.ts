import type { ArchitectureSubmit } from './schemas.js'

export type StructureCheckResult =
  | { ok: true }
  | { ok: false; reason: string; code: 'path' | 'counts' | 'connections' | 'prompt_abuse' }

/**
 * Deterministic graph/structure gates before spending Groq tokens.
 * Optional win rules come from levelContext when the client sends them.
 */
export function checkArchitectureStructure(
  submit: ArchitectureSubmit,
): StructureCheckResult {
  const abuse = /give\s*me\s*(a\s*)?(10|ten)|just\s*pass|score\s*me\s*10/i
  if (abuse.test(submit.explanation)) {
    return {
      ok: false,
      reason: 'Explanation asks for a score instead of justifying the design.',
      code: 'prompt_abuse',
    }
  }

  const reviewMode = submit.levelContext?.reviewMode
  // AI / Ultra: accept the board as submitted; model judges the design text.
  if (reviewMode === 'ai' || reviewMode === 'ultra') {
    return { ok: true }
  }

  if (
    submit.components.length > 1 &&
    submit.connections.length === 0
  ) {
    return {
      ok: false,
      reason: 'Multiple components are placed but none are connected.',
      code: 'connections',
    }
  }

  const win = submit.levelContext?.win
  if (!win) return { ok: true }

  if (win.minCounts) {
    for (const [kind, min] of Object.entries(win.minCounts)) {
      const count = submit.components.filter((c) => c.kind === kind).length
      if (count < (min ?? 0)) {
        return {
          ok: false,
          reason: `Need at least ${min}× ${kind}`,
          code: 'counts',
        }
      }
    }
  }

  const requiredPath = win.requiredPath ?? []
  if (requiredPath.length === 0) return { ok: true }

  const byId = new Map(submit.components.map((n) => [n.id, n]))
  const out = new Map<string, string[]>()
  for (const e of submit.connections) {
    const list = out.get(e.from) ?? []
    list.push(e.to)
    out.set(e.from, list)
  }

  const starts = submit.components.filter((n) => n.kind === requiredPath[0])
  if (starts.length === 0) {
    return {
      ok: false,
      reason: `Missing ${requiredPath[0]} on the required path`,
      code: 'path',
    }
  }

  function matchFrom(nodeId: string, pathIdx: number): boolean {
    if (pathIdx >= requiredPath.length - 1) return true
    const need = requiredPath[pathIdx + 1]
    const nextIds = out.get(nodeId) ?? []
    for (const nid of nextIds) {
      const n = byId.get(nid)
      if (n?.kind === need && matchFrom(nid, pathIdx + 1)) return true
    }
    return false
  }

  for (const start of starts) {
    if (matchFrom(start.id, 0)) return { ok: true }
  }

  return {
    ok: false,
    reason: `Required path not connected: ${requiredPath.join(' → ')}`,
    code: 'path',
  }
}
