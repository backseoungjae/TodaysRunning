// Native milliseconds are converted to Unix seconds at the location-service boundary.
export type RawGpsLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
};

export type LocationTrackingHandle = { stop: () => void };
