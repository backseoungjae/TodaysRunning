import { confirmLocationPermission } from '@/shared/services/locationPermissionAlerts';
import { getLocationPermissionStatus, openAppSettings, requestLocationPermissionFlow } from '@/shared/services/locationService';
import type { LocationPermissionSnapshot } from '@/shared/types/locationPermissionTypes';

// null means START was cancelled or foreground permission was not granted.
export async function prepareRunLocationPermission(): Promise<LocationPermissionSnapshot | null> {
  const current = await getLocationPermissionStatus();
  if (current.foreground.granted) return current;
  if (!await confirmLocationPermission()) return null;
  if (!current.foreground.canAskAgain) {
    await openAppSettings();
    return null;
  }
  const result = await requestLocationPermissionFlow();
  return result.foreground.granted ? result : null;
}
