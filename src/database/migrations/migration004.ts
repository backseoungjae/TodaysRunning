import type { SQLiteDatabase } from 'expo-sqlite';

export async function migration004(db: SQLiteDatabase): Promise<void> {
  // Old fixes remain NULL: wall-clock timestamps cannot reconstruct historical pauses.
  await db.execAsync(`
    ALTER TABLE run_locations ADD COLUMN cumulative_distance_meters REAL CHECK (cumulative_distance_meters >= 0);
    ALTER TABLE run_locations ADD COLUMN active_duration_seconds REAL CHECK (active_duration_seconds >= 0);
  `);
}
