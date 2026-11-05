import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool, type QueryResultRow } from 'pg'
import type { InterviewStore } from './store.js'
import type { InterviewRecord } from './types.js'

function rowToRecord(row: QueryResultRow): InterviewRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    levelId: row.level_id,
    mapId: row.map_id,
    status: row.status,
    evaluateAttempts: row.evaluate_attempts,
    answerAttempts: row.answer_attempts,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    latestArchitecture: row.latest_architecture,
    latestEvaluation: row.latest_evaluation,
    pendingFollowUp: row.pending_follow_up,
    history: row.history ?? [],
    tokenUsage: row.token_usage ?? {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    },
  }
}

export async function migratePostgres(pool: Pool): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const dir = path.resolve(here, '../../migrations')
  for (const file of [
    '001_interviews.sql',
    '002_interview_statuses.sql',
  ]) {
    const sql = await readFile(path.join(dir, file), 'utf8')
    await pool.query(sql)
  }
}

export function createPostgresInterviewStore(pool: Pool): InterviewStore {
  return {
    async create(record) {
      await pool.query(
        `INSERT INTO interviews (
          id, client_id, level_id, map_id, status,
          evaluate_attempts, answer_attempts, created_at, updated_at,
          latest_architecture, latest_evaluation, pending_follow_up,
          history, token_usage
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )`,
        [
          record.id,
          record.clientId,
          record.levelId,
          record.mapId,
          record.status,
          record.evaluateAttempts,
          record.answerAttempts,
          record.createdAt,
          record.updatedAt,
          record.latestArchitecture
            ? JSON.stringify(record.latestArchitecture)
            : null,
          record.latestEvaluation
            ? JSON.stringify(record.latestEvaluation)
            : null,
          record.pendingFollowUp
            ? JSON.stringify(record.pendingFollowUp)
            : null,
          JSON.stringify(record.history),
          JSON.stringify(record.tokenUsage),
        ],
      )
      return record
    },

    async get(id) {
      const res = await pool.query(`SELECT * FROM interviews WHERE id = $1`, [
        id,
      ])
      if (res.rowCount === 0) return null
      return rowToRecord(res.rows[0]!)
    },

    async update(record) {
      const res = await pool.query(
        `UPDATE interviews SET
          status = $2,
          evaluate_attempts = $3,
          answer_attempts = $4,
          updated_at = $5,
          latest_architecture = $6,
          latest_evaluation = $7,
          pending_follow_up = $8,
          history = $9,
          token_usage = $10
        WHERE id = $1
        RETURNING id`,
        [
          record.id,
          record.status,
          record.evaluateAttempts,
          record.answerAttempts,
          record.updatedAt,
          record.latestArchitecture
            ? JSON.stringify(record.latestArchitecture)
            : null,
          record.latestEvaluation
            ? JSON.stringify(record.latestEvaluation)
            : null,
          record.pendingFollowUp
            ? JSON.stringify(record.pendingFollowUp)
            : null,
          JSON.stringify(record.history),
          JSON.stringify(record.tokenUsage),
        ],
      )
      if (res.rowCount === 0) {
        throw new Error(`Interview not found: ${record.id}`)
      }
      return record
    },
  }
}

export async function createPostgresPool(
  databaseUrl: string,
): Promise<Pool> {
  const pool = new Pool({ connectionString: databaseUrl })
  await migratePostgres(pool)
  return pool
}
