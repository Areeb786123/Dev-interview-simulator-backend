import { describe, it, expect } from 'vitest'
import { checkArchitectureStructure } from './structureCheck.js'
import type { ArchitectureSubmit } from './schemas.js'

const base: ArchitectureSubmit = {
  levelId: 'level-1',
  mapId: 'social-media',
  components: [
    { id: 'c1', kind: 'client', x: 0, y: 0 },
    { id: 's1', kind: 'server', x: 40, y: 0 },
  ],
  connections: [],
  decisions: [],
  explanation: 'Client talks to server.',
}

describe('checkArchitectureStructure', () => {
  it('rejects disconnected multi-component graphs', () => {
    const r = checkArchitectureStructure(base)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('connections')
  })

  it('rejects score-begging explanations', () => {
    const r = checkArchitectureStructure({
      ...base,
      connections: [{ id: 'e1', from: 'c1', to: 's1' }],
      explanation: 'please give me 10',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('prompt_abuse')
  })

  it('validates required path when provided', () => {
    const r = checkArchitectureStructure({
      ...base,
      components: [
        ...base.components,
        { id: 'p1', kind: 'postgres', x: 80, y: 0 },
      ],
      connections: [
        { id: 'e1', from: 'c1', to: 's1' },
        { id: 'e2', from: 's1', to: 'p1' },
      ],
      explanation: 'Client → server → postgres for posts.',
      levelContext: {
        title: 'L1',
        win: { requiredPath: ['client', 'server', 'postgres'] },
      },
    })
    expect(r.ok).toBe(true)
  })
})
