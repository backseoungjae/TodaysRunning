import { SPLIT_CONFIG } from '@/constants/splitConfig';
import type { RunLocationMetrics, RunSplit } from '@/database/databaseTypes';

type CalculatedSplit = Pick<RunSplit, 'splitNumber' | 'distanceMeters' | 'durationSeconds' | 'paceSecondsPerKm'>;

// Input: filtered cumulative meters / active seconds, in GPS sequence order.
// Only complete 1km splits are kept; the final partial kilometer is omitted.
// Interpolate a crossing between fixes; pauses and rejected movement are already excluded.
export function calculateSplits(points: readonly RunLocationMetrics[]): CalculatedSplit[] {
  const splits: CalculatedSplit[] = [];
  let previousDistance = 0, previousTime = 0, lastBoundaryTime = 0;
  if (points.length && points[0].cumulativeDistanceMeters !== 0) return [];
  for (const point of points) {
    const distance = point.cumulativeDistanceMeters;
    const time = point.activeDurationSeconds;
    // Missing legacy metrics must not produce estimated historical splits.
    if (distance === null || time === null || !Number.isFinite(distance) || !Number.isFinite(time)
      || distance < previousDistance || time < previousTime) return [];
    if (distance > previousDistance) {
      let boundary = (splits.length + 1) * SPLIT_CONFIG.DISTANCE_METERS;
      while (boundary <= distance + SPLIT_CONFIG.BOUNDARY_EPSILON_METERS) {
        const fraction = Math.min(1, (boundary - previousDistance) / (distance - previousDistance));
        const boundaryTime = previousTime + fraction * (time - previousTime);
        const durationSeconds = boundaryTime - lastBoundaryTime;
        if (durationSeconds <= 0 || !Number.isFinite(durationSeconds)) return [];
        splits.push({ splitNumber: splits.length + 1, distanceMeters: SPLIT_CONFIG.DISTANCE_METERS,
          durationSeconds, paceSecondsPerKm: durationSeconds });
        lastBoundaryTime = boundaryTime;
        boundary = (splits.length + 1) * SPLIT_CONFIG.DISTANCE_METERS;
      }
    }
    previousDistance = distance;
    previousTime = time;
  }
  return splits;
}
