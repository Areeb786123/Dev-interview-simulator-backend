import type { InterviewRecord } from './types.js'

export interface InterviewStore {
  create(record: InterviewRecord): Promise<InterviewRecord>
  get(id: string): Promise<InterviewRecord | null>
  update(record: InterviewRecord): Promise<InterviewRecord>
}
