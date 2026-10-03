import type { Run } from '@/database/databaseTypes';
import { runLocationRepository } from '@/database/repositories/runLocationRepository';
import { runRepository } from '@/database/repositories/runRepository';
import { withDatabaseTransaction } from '@/database/withDatabaseTransaction';

import { useRunStore } from '../store/runStore';
import { getRunActiveDuration } from './runLifecycleService';

// Only the current run is hydrated. SQLite stays the source of permanent records.
export async function synchronizeRunRuntime(run: Run) {
  const snapshot = await withDatabaseTransaction(async (db) => ({
    run: await runRepository.get(run.id, db), route: await runLocationRepository.list(run.id, db),
  }));
  if (!snapshot.run || snapshot.run.state === 'completed') return;
  run = snapshot.run;
  const route = snapshot.route;
  if (useRunStore.getState().runId !== run.id) return;
  const elapsedSeconds = getRunActiveDuration(run);
  const last = route.at(-1);
  if (last && (useRunStore.getState().currentLocation?.timestamp ?? 0) > last.recordedAt) return;
  useRunStore.setState({ distanceMeters: run.distanceMeters, elapsedSeconds, elapsedSecondsAtResume: elapsedSeconds,
    activeStartedAtMs: useRunStore.getState().status === 'running' ? Date.now() : null,
    routeCoordinates: route.map(({latitude, longitude}) => ({latitude, longitude})),
    currentLocation: last && last.accuracy !== null ? { latitude: last.latitude, longitude: last.longitude,
      accuracy: last.accuracy, altitude: last.altitude, speed: last.speed, timestamp: last.recordedAt, validated: true } : null });
}

export async function refreshRunRuntime(runId: string) {
  const run = await runRepository.get(runId);
  if (run && run.state === 'running') await synchronizeRunRuntime(run);
}
