import type { SQLiteDatabase } from 'expo-sqlite';

import { runLocationRepository } from '@/database/repositories/runLocationRepository';
import { runRepository } from '@/database/repositories/runRepository';
import { withDatabaseTransaction } from '@/database/withDatabaseTransaction';
import type { RawGpsLocation } from '@/shared/types/locationTypes';

import type { GpsFilterResult, ValidGpsLocation } from '../types/gpsTypes';
import { filterGpsLocation } from './gpsFilterService';

export async function persistRunLocation(input: {
  runId: string; sequence: number; raw: RawGpsLocation; previous: ValidGpsLocation | null;
  receivedAt: number; maxAgeSeconds?: number;
}, db?: SQLiteDatabase): Promise<GpsFilterResult> {
  const result = filterGpsLocation(input.raw, input.previous, input.receivedAt, input.maxAgeSeconds);
  if (!result.accepted) return result;
  const location = result.location;
  const distance = result.distanceFromPreviousMeters;
  async function save(connection: SQLiteDatabase): Promise<GpsFilterResult> {
    const run = await runRepository.get(input.runId, connection);
    if (!run || run.state !== 'running') return { accepted: false, reason: 'out_of_order' };
    const last = await runLocationRepository.getLast(input.runId, connection);
    if (last && location.timestamp <= last.recordedAt) return { accepted: false, reason: 'out_of_order' };
    const cumulativeDistanceMeters = run.distanceMeters + distance;
    // Use capture time for delayed background batches, excluding all committed pauses.
    const activeDurationSeconds = Math.max(run.activeDurationSeconds, 0,
      Math.min(location.timestamp, input.receivedAt) - run.startedAt - run.pausedDurationSeconds);
    await runLocationRepository.create({
    id: `${input.runId}:${input.sequence}`, runId: input.runId, sequence: input.sequence,
    latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy,
    altitude: location.altitude, speed: location.speed, recordedAt: location.timestamp,
    cumulativeDistanceMeters, activeDurationSeconds,
    }, connection);
    await runRepository.update({ ...run, distanceMeters: cumulativeDistanceMeters,
      updatedAt: input.receivedAt }, connection);
    return result;
  }
  return db ? save(db) : withDatabaseTransaction(save);
}
