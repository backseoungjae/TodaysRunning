import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../database';

export type BackgroundTrackingSession = {
  runId: string;
  startedAt: number;
  firstSequence: number;
  error: string | null;
};
export const backgroundTrackingRepository = {
  async get(db?: SQLiteDatabase): Promise<BackgroundTrackingSession | null> {
    return (db ?? await getDatabase()).getFirstAsync<BackgroundTrackingSession>(
      'SELECT run_id AS runId, started_at AS startedAt, first_sequence AS firstSequence, error FROM background_tracking_session WHERE singleton = 1',
    );
  },
  async set(session: BackgroundTrackingSession, db?: SQLiteDatabase): Promise<void> {
    await (db ?? await getDatabase()).runAsync(
      'INSERT OR REPLACE INTO background_tracking_session (singleton, run_id, started_at, first_sequence, error) VALUES (1, ?, ?, ?, ?)',
      session.runId, session.startedAt, session.firstSequence, session.error,
    );
  },
  async clear(runId: string, db?: SQLiteDatabase): Promise<void> {
    await (db ?? await getDatabase()).runAsync('DELETE FROM background_tracking_session WHERE run_id = ?', runId);
  },
  async setError(runId: string, error: string, db?: SQLiteDatabase): Promise<void> {
    await (db ?? await getDatabase()).runAsync('UPDATE background_tracking_session SET error = ? WHERE run_id = ?', error, runId);
  },
};
