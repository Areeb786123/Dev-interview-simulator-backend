import type { InterviewStore } from './store.js'
import type { InterviewRecord } from './types.js'

export function createMemoryInterviewStore(): InterviewStore {
  const byId = new Map<string, InterviewRecord>()

  return {
    async create(record) {
      byId.set(record.id, structuredClone(record))
      return structuredClone(record)
    },
    async get(id) {
      const found = byId.get(id)
      return found ? structuredClone(found) : null
    },
    async update(record) {
      if (!byId.has(record.id)) {
        throw new Error(`Interview not found: ${record.id}`)
      }
      byId.set(record.id, structuredClone(record))
      return structuredClone(record)
    },
  }
}
