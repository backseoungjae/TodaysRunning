import type { SQLiteDatabase } from 'expo-sqlite';

import { runLocationRepository } from '@/database/repositories/runLocationRepository';
import { runSplitRepository } from '@/database/repositories/runSplitRepository';

import { calculateSplits } from '../utils/calculateSplits';

// The lifecycle owns this transaction, including completion and training progress.
export async function saveRunSplits(runId: string, db: SQLiteDatabase): Promise<void> {
  const metrics = await runLocationRepository.listMetrics(runId, db);
  const splits = calculateSplits(metrics);
  await runSplitRepository.deleteForRun(runId, db);
  for (const split of splits) {
    await runSplitRepository.create({ ...split, id: `${runId}:split:${split.splitNumber}`, runId }, db);
  }
}
