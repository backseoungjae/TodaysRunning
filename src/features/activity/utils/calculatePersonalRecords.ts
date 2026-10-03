import type { Fastest5KRecord, Run } from '@/database/databaseTypes';

// All-time completed summaries; ties keep the newest-first repository order.
export function calculatePersonalRecords(runs: readonly Run[], fastest5K: Fastest5KRecord | null) {
  let longestRun: Run | null = null;
  let longestDuration: Run | null = null;
  for (const run of runs) {
    if (run.state !== 'completed') continue;
    if (Number.isFinite(run.distanceMeters) && run.distanceMeters > (longestRun?.distanceMeters ?? 0)) longestRun = run;
    if (Number.isFinite(run.activeDurationSeconds)
      && run.activeDurationSeconds > (longestDuration?.activeDurationSeconds ?? 0)) longestDuration = run;
  }
  return { longestRun, longestDuration, fastest5K };
}
