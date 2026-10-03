import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../database';
import type { TrainingProgress } from '../databaseTypes';

const selectColumns = `
  plan_id AS planId,
  session_id AS sessionId,
  status AS status,
  completed_run_id AS completedRunId,
  completed_at AS completedAt
`;

// Optional connection supports composing repositories inside a caller-owned transaction.
export const trainingRepository = {
  async complete(planId: string, sessionId: string, runId: string, completedAt: number, db?: SQLiteDatabase): Promise<void> {
    const connection = db ?? (await getDatabase());
    await connection.runAsync(
      `INSERT INTO training_progress (plan_id, session_id, status, completed_run_id, completed_at)
       VALUES (?, ?, 'completed', ?, ?)
       ON CONFLICT(plan_id, session_id) DO UPDATE SET
         status = excluded.status, completed_run_id = excluded.completed_run_id, completed_at = excluded.completed_at
       WHERE training_progress.status <> 'completed' OR training_progress.completed_run_id IS NULL`,
      planId, sessionId, runId, completedAt,
    );
  },
  async create(value: TrainingProgress, db?: SQLiteDatabase): Promise<void> {
    const connection = db ?? (await getDatabase());
    await connection.runAsync(
      `INSERT INTO training_progress (
        plan_id,
        session_id,
        status,
        completed_run_id,
        completed_at
      ) VALUES (?, ?, ?, ?, ?)`,
      value.planId,
      value.sessionId,
      value.status,
      value.completedRunId,
      value.completedAt,
    );
  },

  async get(planId: string, sessionId: string, db?: SQLiteDatabase): Promise<TrainingProgress | null> {
    const connection = db ?? (await getDatabase());
    return connection.getFirstAsync<TrainingProgress>(
      `SELECT ${selectColumns} FROM training_progress WHERE plan_id = ? AND session_id = ?`, planId, sessionId,
    );
  },

  async list(planId: string, db?: SQLiteDatabase): Promise<TrainingProgress[]> {
    const connection = db ?? (await getDatabase());
    return connection.getAllAsync<TrainingProgress>(
      `SELECT ${selectColumns} FROM training_progress WHERE plan_id = ? ORDER BY session_id ASC`, planId,
    );
  },

  async update(value: TrainingProgress, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync(
      `UPDATE training_progress SET
        status = ?,
        completed_run_id = ?,
        completed_at = ?
      WHERE plan_id = ? AND session_id = ?`,
      value.status,
      value.completedRunId,
      value.completedAt,
      value.planId,
      value.sessionId,
    );
    return result.changes > 0;
  },

  async delete(planId: string, sessionId: string, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync('DELETE FROM training_progress WHERE plan_id = ? AND session_id = ?', planId, sessionId);
    return result.changes > 0;
  },
};
