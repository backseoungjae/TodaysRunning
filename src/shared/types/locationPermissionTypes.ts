import type { LocationPermissionResponse, PermissionResponse } from 'expo-location';

export type LocationPermissionStatus = 'none' | 'foreground' | 'background' | 'denied' | 'blocked';

export type LocationPermissionSnapshot = {
  status: LocationPermissionStatus;
  foreground: LocationPermissionResponse;
  background: PermissionResponse | null;
  backgroundStatusUnavailable: boolean;
};
