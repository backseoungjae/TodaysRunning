import { RUN_METRICS_CONFIG } from '@/constants/runMetricsConfig';

// Input: meters and active seconds. Output: seconds/km, or null before a reliable baseline.
export function calculatePaceSecondsPerKm(distanceMeters: number, activeSeconds: number): number | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters < RUN_METRICS_CONFIG.MIN_PACE_DISTANCE_METERS
    || !Number.isFinite(activeSeconds) || activeSeconds <= 0) return null;
  const pace = activeSeconds / (distanceMeters / 1000);
  return Number.isFinite(pace) && pace > 0 ? pace : null;
}
