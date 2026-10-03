import type { SQLiteDatabase } from 'expo-sqlite';

import { SPLIT_CONFIG } from '../../constants/splitConfig';

import { getDatabase } from '../database';
import type { Fastest5KRecord, Run } from '../databaseTypes';

const selectColumns = `
  id AS id,
  source AS source,
  goal_type AS goalType,
  target_distance_meters AS targetDistanceMeters,
  target_duration_seconds AS targetDurationSeconds,
  started_at AS startedAt,
  ended_at AS endedAt,
  state AS state,
  distance_meters AS distanceMeters,
  active_duration_seconds AS activeDurationSeconds,
  paused_duration_seconds AS pausedDurationSeconds,
  paused_at AS pausedAt,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

// Optional connection supports composing repositories inside a caller-owned transaction.
export const runRepository = {
  async generateId(db?: SQLiteDatabase): Promise<string> {
    const connection = db ?? (await getDatabase());
    const row = await connection.getFirstAsync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id');
    if (!row) throw new Error('Could not generate run ID.');
    return row.id;
  },
  async create(value: Run, db?: SQLiteDatabase): Promise<void> {
    const connection = db ?? (await getDatabase());
    await connection.runAsync(
      `INSERT INTO runs (
        id,
        source,
        goal_type,
        target_distance_meters,
        target_duration_seconds,
        started_at,
        ended_at,
        state,
        distance_meters,
        active_duration_seconds,
        paused_duration_seconds,
        paused_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      value.id,
      value.source,
      value.goalType,
      value.targetDistanceMeters,
      value.targetDurationSeconds,
      value.startedAt,
      value.endedAt,
      value.state,
      value.distanceMeters,
      value.activeDurationSeconds,
      value.pausedDurationSeconds,
      value.pausedAt,
      value.createdAt,
      value.updatedAt,
    );
  },

  async get(id: string, db?: SQLiteDatabase): Promise<Run | null> {
    const connection = db ?? (await getDatabase());
    return connection.getFirstAsync<Run>(
      `SELECT ${selectColumns} FROM runs WHERE id = ?`, id,
    );
  },

  async list(db?: SQLiteDatabase): Promise<Run[]> {
    const connection = db ?? (await getDatabase());
    return connection.getAllAsync<Run>(
      `SELECT ${selectColumns} FROM runs ORDER BY started_at DESC, id DESC`,
    );
  },

  async countCompletedInPeriod(startSeconds: number, endSeconds: number, db?: SQLiteDatabase): Promise<number> {
    const connection = db ?? (await getDatabase());
    const row = await connection.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM runs WHERE state = 'completed' AND started_at >= ? AND started_at < ?",
      startSeconds,
      endSeconds,
    );
    return row?.count ?? 0;
  },

  async findFastest5K(db?: SQLiteDatabase): Promise<Fastest5KRecord | null> {
    const connection = db ?? (await getDatabase());
    // Actual first 5km active time, never extrapolated from a longer run's average pace.
    // Summaries and stored splits only: no GPS hydration for the Activity list.
    return connection.getFirstAsync<Fastest5KRecord>(
      `SELECT ${selectColumns}, recordDurationSeconds FROM runs JOIN (
        SELECT run_id AS recordRunId, SUM(duration_seconds) AS recordDurationSeconds
        FROM run_splits WHERE split_number BETWEEN 1 AND ? AND distance_meters = ? AND duration_seconds > 0
        GROUP BY run_id HAVING COUNT(*) = ?
      ) ON recordRunId = runs.id
      WHERE state = 'completed' AND distance_meters >= ?
      ORDER BY recordDurationSeconds ASC, started_at DESC, id DESC LIMIT 1`,
      SPLIT_CONFIG.PERSONAL_RECORD_DISTANCE_METERS / SPLIT_CONFIG.DISTANCE_METERS,
      SPLIT_CONFIG.DISTANCE_METERS,
      SPLIT_CONFIG.PERSONAL_RECORD_DISTANCE_METERS / SPLIT_CONFIG.DISTANCE_METERS,
      SPLIT_CONFIG.PERSONAL_RECORD_DISTANCE_METERS,
    );
  },

  async listCompleted(db?: SQLiteDatabase): Promise<Run[]> {
    const connection = db ?? (await getDatabase());
    return connection.getAllAsync<Run>(
      `SELECT ${selectColumns} FROM runs WHERE state = 'completed' ORDER BY started_at DESC, id DESC`,
    );
  },

  async setTrainingSession(id: string, selection: { planId: string; sessionId: string }, db?: SQLiteDatabase): Promise<void> {
    const connection = db ?? (await getDatabase());
    await connection.runAsync('UPDATE runs SET training_plan_id = ?, training_session_id = ? WHERE id = ?',
      selection.planId, selection.sessionId, id);
  },

  async getTrainingSession(id: string, db?: SQLiteDatabase): Promise<{ planId: string; sessionId: string } | null> {
    const connection = db ?? (await getDatabase());
    return connection.getFirstAsync<{ planId: string; sessionId: string }>(
      `SELECT training_plan_id AS planId, training_session_id AS sessionId FROM runs
       WHERE id = ? AND training_plan_id IS NOT NULL AND training_session_id IS NOT NULL`, id,
    );
  },

  async summarizeCompletedInPeriod(startSeconds: number, endSeconds: number, db?: SQLiteDatabase) {
    const connection = db ?? (await getDatabase());
    const row = await connection.getFirstAsync<{ runCount: number; distanceMeters: number; activeDurationSeconds: number }>(
      `SELECT COUNT(*) AS runCount, COALESCE(SUM(distance_meters), 0) AS distanceMeters,
        COALESCE(SUM(active_duration_seconds), 0) AS activeDurationSeconds
       FROM runs WHERE state = 'completed' AND started_at >= ? AND started_at < ?`,
      startSeconds, endSeconds,
    );
    return row ?? { runCount: 0, distanceMeters: 0, activeDurationSeconds: 0 };
  },

  async update(value: Run, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync(
      `UPDATE runs SET
        source = ?,
        goal_type = ?,
        target_distance_meters = ?,
        target_duration_seconds = ?,
        started_at = ?,
        ended_at = ?,
        state = ?,
        distance_meters = ?,
        active_duration_seconds = ?,
        paused_duration_seconds = ?,
        paused_at = ?,
        updated_at = ?
      WHERE id = ?`,
      value.source,
      value.goalType,
      value.targetDistanceMeters,
      value.targetDurationSeconds,
      value.startedAt,
      value.endedAt,
      value.state,
      value.distanceMeters,
      value.activeDurationSeconds,
      value.pausedDurationSeconds,
      value.pausedAt,
      value.updatedAt,
      value.id,
    );
    return result.changes > 0;
  },

  async delete(id: string, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync('DELETE FROM runs WHERE id = ?', id);
    return result.changes > 0;
  },
};
