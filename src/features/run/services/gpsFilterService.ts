import { GPS_CONFIG } from '@/constants/gpsConfig';
import type { RawGpsLocation } from '@/shared/types/locationTypes';

import type { GpsFilterResult, ValidGpsLocation } from '../types/gpsTypes';
import { calculateDistanceMeters } from '../utils/calculateDistance';

export function filterGpsLocation(
  raw: RawGpsLocation,
  previous: ValidGpsLocation | null,
  nowSeconds = Date.now() / 1000,
  maxAgeSeconds: number = GPS_CONFIG.MAX_LOCATION_AGE_SECONDS,
): GpsFilterResult {
  if (!Number.isFinite(raw.latitude) || !Number.isFinite(raw.longitude)
    || Math.abs(raw.latitude) > 90 || Math.abs(raw.longitude) > 180) {
    return { accepted: false, reason: 'invalid_coordinate' };
  }
  if (!Number.isFinite(raw.timestamp) || raw.timestamp <= 0
    || raw.timestamp > nowSeconds + GPS_CONFIG.MAX_FUTURE_TIMESTAMP_SECONDS) {
    return { accepted: false, reason: 'invalid_timestamp' };
  }
  if (nowSeconds - raw.timestamp > maxAgeSeconds) return { accepted: false, reason: 'stale' };
  if (raw.accuracy === null || !Number.isFinite(raw.accuracy) || raw.accuracy < 0
    || raw.accuracy > GPS_CONFIG.MAX_ACCEPTABLE_ACCURACY) return { accepted: false, reason: 'poor_accuracy' };
  if (raw.speed !== null && !Number.isFinite(raw.speed)) return { accepted: false, reason: 'invalid_speed' };
  if (raw.speed !== null && raw.speed > GPS_CONFIG.MAX_RUNNING_SPEED) return { accepted: false, reason: 'excessive_speed' };
  const location: ValidGpsLocation = {
    ...raw,
    accuracy: raw.accuracy,
    // Native providers can report negative speed to mean unavailable.
    speed: raw.speed !== null && raw.speed >= 0 ? raw.speed : null,
    altitude: raw.altitude !== null && Number.isFinite(raw.altitude) ? raw.altitude : null,
    validated: true,
  };
  if (!previous) return { accepted: true, location, distanceFromPreviousMeters: 0 };
  const elapsedSeconds = location.timestamp - previous.timestamp;
  if (elapsedSeconds <= 0) return { accepted: false, reason: 'out_of_order' };
  // Never infer movement across a prolonged loss of signal.
  if (elapsedSeconds > GPS_CONFIG.MAX_CONTINUOUS_GAP_SECONDS) {
    return { accepted: true, location, distanceFromPreviousMeters: 0 };
  }
  const distance = calculateDistanceMeters(previous, location);
  if (distance > GPS_CONFIG.MAX_LOCATION_JUMP) return { accepted: false, reason: 'location_jump' };
  if (distance / elapsedSeconds > GPS_CONFIG.MAX_RUNNING_SPEED) return { accepted: false, reason: 'excessive_speed' };
  if (distance < GPS_CONFIG.MIN_LOCATION_DISTANCE) return { accepted: false, reason: 'noise' };
  return { accepted: true, location, distanceFromPreviousMeters: distance };
}
