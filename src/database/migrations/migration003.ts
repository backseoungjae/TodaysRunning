import type { SQLiteDatabase } from 'expo-sqlite';

export async function migration003(db: SQLiteDatabase): Promise<void> {
  // Persist identifiers only; plan definitions remain versioned TypeScript data.
  await db.execAsync(`
    ALTER TABLE runs ADD COLUMN training_plan_id TEXT;
    ALTER TABLE runs ADD COLUMN training_session_id TEXT;
  `);
}
