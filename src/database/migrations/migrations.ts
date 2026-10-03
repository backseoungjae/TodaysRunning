import type { SQLiteDatabase } from 'expo-sqlite';

import { migration001 } from './migration001';
import { migration002 } from './migration002';
import { migration003 } from './migration003';
import { migration004 } from './migration004';

export const migrations = [{ version: 1, apply: migration001 }, { version: 2, apply: migration002 }, { version: 3, apply: migration003 }, { version: 4, apply: migration004 }] as const;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  const latestVersion = migrations[migrations.length - 1].version;
  if (version > latestVersion) {
    throw new Error('Database schema is newer than this app supports.');
  }
  // Initialization finishes before any repository receives this connection.
  for (const migration of migrations) {
    if (migration.version <= version) continue;
    await db.withTransactionAsync(async () => {
      await migration.apply(db);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
