import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getDatabase } from './database';

let transactionQueue: Promise<unknown> = Promise.resolve();

export async function withDatabaseTransaction<T>(operation: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const db = await getDatabase();
  // Serialize callers so goal snapshots/settings and Run commits cannot overlap.
  const next = transactionQueue.then(async () => {
    let result: T;
    if (Platform.OS !== 'web') {
      await db.withExclusiveTransactionAsync(async (transaction) => { result = await operation(transaction); });
    } else {
      // Exclusive transactions are unavailable on web.
      await db.withTransactionAsync(async () => { result = await operation(db); });
    }
    return result!;
  });
  transactionQueue = next.catch(() => undefined);
  return next;
}
