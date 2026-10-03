import type { SQLiteDatabase } from 'expo-sqlite';

export async function migration002(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE background_tracking_session (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      started_at REAL NOT NULL,
      first_sequence INTEGER NOT NULL CHECK (first_sequence >= 0),
      error TEXT
    );
  `);
}
