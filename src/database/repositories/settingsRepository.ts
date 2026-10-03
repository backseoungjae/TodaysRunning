import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../database';
import type { AppSettings } from '../databaseTypes';

export const settingsRepository = {
  async get<K extends keyof AppSettings>(key: K, db?: SQLiteDatabase): Promise<AppSettings[K] | null> {
    const connection = db ?? (await getDatabase());
    const row = await connection.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
    return row ? JSON.parse(row.value) as AppSettings[K] : null;
  },

  async set<K extends keyof AppSettings>(key: K, value: AppSettings[K], db?: SQLiteDatabase): Promise<void> {
    const connection = db ?? (await getDatabase());
    await connection.runAsync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key, JSON.stringify(value),
    );
  },

  async delete(key: keyof AppSettings, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync('DELETE FROM app_settings WHERE key = ?', key);
    return result.changes > 0;
  },
};
