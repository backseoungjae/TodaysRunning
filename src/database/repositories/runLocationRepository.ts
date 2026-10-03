import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../database';
import type { RunLocation, RunLocationMetrics } from '../databaseTypes';

const selectColumns = `
  id AS id,
  run_id AS runId,
  sequence AS sequence,
  latitude AS latitude,
  longitude AS longitude,
  altitude AS altitude,
  accuracy AS accuracy,
  speed AS speed,
  recorded_at AS recordedAt
`;

// Optional connection supports composing repositories inside a caller-owned transaction.
export const runLocationRepository = {
  async listMetrics(runId: string, db?: SQLiteDatabase): Promise<RunLocationMetrics[]> {
    const connection = db ?? (await getDatabase());
    return connection.getAllAsync<RunLocationMetrics>(
      `SELECT cumulative_distance_meters AS cumulativeDistanceMeters, active_duration_seconds AS activeDurationSeconds
       FROM run_locations WHERE run_id = ? ORDER BY sequence ASC`, runId,
    );
  },
  async getLast(runId: string, db?: SQLiteDatabase): Promise<RunLocation | null> {
    const connection = db ?? (await getDatabase());
    return connection.getFirstAsync<RunLocation>(
      `SELECT ${selectColumns} FROM run_locations WHERE run_id = ? ORDER BY sequence DESC LIMIT 1`, runId,
    );
  },
  async create(value: RunLocation & Partial<RunLocationMetrics>, db?: SQLiteDatabase): Promise<void> {
    const connection = db ?? (await getDatabase());
    await connection.runAsync(
      `INSERT INTO run_locations (
        id,
        run_id,
        sequence,
        latitude,
        longitude,
        altitude,
        accuracy,
        speed,
        recorded_at,
        cumulative_distance_meters,
        active_duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      value.id,
      value.runId,
      value.sequence,
      value.latitude,
      value.longitude,
      value.altitude,
      value.accuracy,
      value.speed,
      value.recordedAt,
      value.cumulativeDistanceMeters ?? null,
      value.activeDurationSeconds ?? null,
    );
  },

  async get(id: string, db?: SQLiteDatabase): Promise<RunLocation | null> {
    const connection = db ?? (await getDatabase());
    return connection.getFirstAsync<RunLocation>(
      `SELECT ${selectColumns} FROM run_locations WHERE id = ?`, id,
    );
  },

  async list(runId: string, db?: SQLiteDatabase): Promise<RunLocation[]> {
    const connection = db ?? (await getDatabase());
    return connection.getAllAsync<RunLocation>(
      `SELECT ${selectColumns} FROM run_locations WHERE run_id = ? ORDER BY sequence ASC`, runId,
    );
  },

  async update(value: RunLocation, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync(
      `UPDATE run_locations SET
        run_id = ?,
        sequence = ?,
        latitude = ?,
        longitude = ?,
        altitude = ?,
        accuracy = ?,
        speed = ?,
        recorded_at = ?
      WHERE id = ?`,
      value.runId,
      value.sequence,
      value.latitude,
      value.longitude,
      value.altitude,
      value.accuracy,
      value.speed,
      value.recordedAt,
      value.id,
    );
    return result.changes > 0;
  },

  async delete(id: string, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync('DELETE FROM run_locations WHERE id = ?', id);
    return result.changes > 0;
  },
};
