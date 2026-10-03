import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

import { GPS_CONFIG } from '@/constants/gpsConfig';

import type { LocationPermissionSnapshot, LocationPermissionStatus } from '../types/locationPermissionTypes';
import type { LocationTrackingHandle, RawGpsLocation } from '../types/locationTypes';

function permissionStatus(
  foreground: Location.LocationPermissionResponse,
  background: Location.PermissionResponse | null,
): LocationPermissionStatus {
  if (foreground.granted) return background?.granted ? 'background' : 'foreground';
  if (!foreground.canAskAgain) return 'blocked';
  return foreground.status === 'undetermined' ? 'none' : 'denied';
}

export async function getLocationPermissionStatus(): Promise<LocationPermissionSnapshot> {
  const foreground = await Location.getForegroundPermissionsAsync();
  let background: Location.PermissionResponse | null = null;
  let backgroundStatusUnavailable = false;
  // Web reports the same geolocation permission for both APIs; it is not background permission.
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      background = await Location.getBackgroundPermissionsAsync();
    } catch {
      backgroundStatusUnavailable = true;
    }
  }
  return { status: permissionStatus(foreground, background), foreground, background, backgroundStatusUnavailable };
}

export async function requestForegroundPermission(): Promise<Location.LocationPermissionResponse> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current;
  return Location.requestForegroundPermissionsAsync();
}

export async function requestBackgroundPermission(): Promise<LocationPermissionSnapshot> {
  const current = await getLocationPermissionStatus();
  if (!current.foreground.granted || current.background?.granted || !current.background?.canAskAgain) return current;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return current;
  try {
    if (!await Location.isBackgroundLocationAvailableAsync()) return current;
    await Location.requestBackgroundPermissionsAsync();
  } catch {
    // Background support can be unavailable (including Expo Go). Never revoke foreground access.
    const latest = await getLocationPermissionStatus();
    return { ...latest, backgroundStatusUnavailable: true };
  }
  return getLocationPermissionStatus();
}

let permissionFlow: Promise<LocationPermissionSnapshot> | undefined;

export function requestLocationPermissionFlow(): Promise<LocationPermissionSnapshot> {
  if (!permissionFlow) {
    permissionFlow = (async () => {
      const foreground = await requestForegroundPermission();
      if (!foreground.granted) return getLocationPermissionStatus();
      return requestBackgroundPermission();
    })().finally(() => { permissionFlow = undefined; });
  }
  return permissionFlow;
}

export async function openAppSettings(): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('브라우저의 사이트 설정에서 위치 권한을 변경해 주세요.');
  }
  await Linking.openSettings();
}

export async function startLocationTracking(
  onLocation: (location: RawGpsLocation) => void,
  onError: (message: string) => void,
): Promise<LocationTrackingHandle> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('앱 사용 중 위치 권한이 필요해요. 설정에서 권한을 확인해 주세요.');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('기기의 위치 서비스를 켜 주세요.');
  let active = true;
  const subscription = await Location.watchPositionAsync({
    accuracy: Location.Accuracy.High,
    timeInterval: GPS_CONFIG.UPDATE_INTERVAL_MS,
    distanceInterval: GPS_CONFIG.UPDATE_DISTANCE_METERS,
    mayShowUserSettingsDialog: false,
  }, (location) => {
    if (!active) return;
    onLocation(toRawGpsLocation(location));
  }, (message) => { if (active) onError(message); });
  return {
    stop() {
      if (!active) return;
      active = false;
      subscription.remove();
    },
  };
}

export async function getCurrentRunLocation(): Promise<RawGpsLocation> {
  if (!(await Location.getForegroundPermissionsAsync()).granted) throw new Error('앱 사용 중 위치 권한이 필요해요.');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('기기의 위치 서비스를 켜 주세요.');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('GPS 신호를 찾지 못했어요. 하늘이 잘 보이는 곳에서 다시 시도해 주세요.')), GPS_CONFIG.READY_TIMEOUT_MS); }),
    ]);
    return toRawGpsLocation(location);
  } finally { if (timeout) clearTimeout(timeout); }
}

export function stopLocationTracking(handle: LocationTrackingHandle): void {
  handle.stop();
}

export function toRawGpsLocation(location: Location.LocationObject): RawGpsLocation {
  return { latitude: location.coords.latitude, longitude: location.coords.longitude,
    accuracy: location.coords.accuracy, altitude: location.coords.altitude,
    speed: location.coords.speed, timestamp: location.timestamp / 1000 };
}
