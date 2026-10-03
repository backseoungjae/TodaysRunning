import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../database';
import type { RunSplit } from '../databaseTypes';

const selectColumns = `
  id AS id,
  run_id AS runId,
  split_number AS splitNumber,
  distance_meters AS distanceMeters,
  duration_seconds AS durationSeconds,
  pace_seconds_per_km AS paceSecondsPerKm
`;

// Optional connection supports composing repositories inside a caller-owned transaction.
export const runSplitRepository = {
  async create(value: RunSplit, db?: SQLiteDatabase): Promise<void> {
    const connection = db ?? (await getDatabase());
    await connection.runAsync(
      `INSERT INTO run_splits (
        id,
        run_id,
        split_number,
        distance_meters,
        duration_seconds,
        pace_seconds_per_km
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      value.id,
      value.runId,
      value.splitNumber,
      value.distanceMeters,
      value.durationSeconds,
      value.paceSecondsPerKm,
    );
  },

  async get(id: string, db?: SQLiteDatabase): Promise<RunSplit | null> {
    const connection = db ?? (await getDatabase());
    return connection.getFirstAsync<RunSplit>(
      `SELECT ${selectColumns} FROM run_splits WHERE id = ?`, id,
    );
  },

  async list(runId: string, db?: SQLiteDatabase): Promise<RunSplit[]> {
    const connection = db ?? (await getDatabase());
    return connection.getAllAsync<RunSplit>(
      `SELECT ${selectColumns} FROM run_splits WHERE run_id = ? ORDER BY split_number ASC`, runId,
    );
  },

  async update(value: RunSplit, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync(
      `UPDATE run_splits SET
        run_id = ?,
        split_number = ?,
        distance_meters = ?,
        duration_seconds = ?,
        pace_seconds_per_km = ?
      WHERE id = ?`,
      value.runId,
      value.splitNumber,
      value.distanceMeters,
      value.durationSeconds,
      value.paceSecondsPerKm,
      value.id,
    );
    return result.changes > 0;
  },

  async deleteForRun(runId: string, db?: SQLiteDatabase): Promise<void> {
    const connection = db ?? (await getDatabase());
    await connection.runAsync('DELETE FROM run_splits WHERE run_id = ?', runId);
  },

  async delete(id: string, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync('DELETE FROM run_splits WHERE id = ?', id);
    return result.changes > 0;
  },
};
