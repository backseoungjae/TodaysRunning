import type { RawGpsLocation } from '@/shared/types/locationTypes';

export type ValidGpsLocation = RawGpsLocation & { validated: true; accuracy: number };
export type GpsRejectionReason = 'invalid_coordinate' | 'invalid_timestamp' | 'stale' | 'poor_accuracy'
  | 'invalid_speed' | 'excessive_speed' | 'out_of_order' | 'location_jump' | 'noise';
export type GpsFilterResult =
  | { accepted: true; location: ValidGpsLocation; distanceFromPreviousMeters: number }
  | { accepted: false; reason: GpsRejectionReason };
