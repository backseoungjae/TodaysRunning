import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { BACKGROUND_LOCATION_TASK, GPS_CONFIG } from '@/constants/gpsConfig';
import { getDatabase } from '@/database/database';
import { backgroundTrackingRepository } from '@/database/repositories/backgroundTrackingRepository';
import { runLocationRepository } from '@/database/repositories/runLocationRepository';
import { runRepository } from '@/database/repositories/runRepository';
import { getLocationPermissionStatus, toRawGpsLocation } from '@/shared/services/locationService';
import type { RawGpsLocation } from '@/shared/types/locationTypes';

import type { GpsFilterResult, ValidGpsLocation } from '../types/gpsTypes';
import { persistRunLocation } from './runLocationPersistence';
import { pauseRun } from './runLifecycleService';

type BackgroundEvent = { runId: string; error: string } | {
  runId: string; raw: RawGpsLocation; result: GpsFilterResult; savedLocationCount: number;
};
const listeners = new Set<(event: BackgroundEvent) => void>();
const closing = new Set<string>();
let nativeOwner: string | null = null;
let nativeStopPromise: Promise<void> | null = null;
function stopNativeTask(): Promise<void> {
  if (!nativeStopPromise) {
    nativeStopPromise = (async () => {
      if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    })().finally(() => { nativeStopPromise = null; });
  }
  return nativeStopPromise;
}
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation);
  queue = next.catch(() => undefined);
  return next;
}
function publish(event: BackgroundEvent) { for (const listener of listeners) listener(event); }
export function subscribeBackgroundLocations(listener: (event: BackgroundEvent) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function startBackgroundTracking(runId: string): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  const permission = await getLocationPermissionStatus();
  if (!permission.foreground.granted || !permission.background?.granted) {
    await stopBackgroundTracking(runId);
    return false;
  }
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    || !await TaskManager.isAvailableAsync() || !await Location.isBackgroundLocationAvailableAsync()) {
    await stopBackgroundTracking(runId);
    return false;
  }
  if (!await Location.hasServicesEnabledAsync()) throw new Error('기기의 위치 서비스를 켜 주세요.');
  const existing = await backgroundTrackingRepository.get();
  if (existing && existing.runId !== runId && !existing.error) throw new Error('다른 러닝의 위치 추적이 진행 중이에요.');
  nativeOwner = runId;
  // Starting happens while the Run screen is active, before Android restricts foreground service startup.
  await stopNativeTask();
  await enqueue(async () => {
    const current = await backgroundTrackingRepository.get();
    if (current && current.runId !== runId && !current.error) throw new Error('다른 러닝의 위치 추적이 진행 중이에요.');
    const run = await runRepository.get(runId);
    if (!run || run.state !== 'running') throw new Error('진행 중인 러닝 기록을 찾을 수 없어요.');
    const last = await runLocationRepository.getLast(runId);
    closing.delete(runId);
    await backgroundTrackingRepository.set({runId, startedAt: Date.now() / 1000,
      firstSequence: last ? last.sequence + 1 : 0, error: null});
  });
  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: GPS_CONFIG.UPDATE_DISTANCE_METERS,
      timeInterval: GPS_CONFIG.UPDATE_INTERVAL_MS,
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      ...(Platform.OS === 'android' ? {foregroundService: {
        notificationTitle: '오늘의 러닝', notificationBody: '러닝 위치와 이동 경로를 기록하고 있어요.',
        killServiceOnDestroy: true,
      }} : {}),
    });
    return true;
  } catch (error) {
    // Do not run a foreground watcher until a partially registered task has been stopped.
    await stopBackgroundTracking(runId);
    throw error;
  }
}

export async function stopBackgroundTracking(runId: string): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  closing.add(runId);
  const ownsTask = await enqueue(async () => {
    const session = await backgroundTrackingRepository.get();
    if (session?.runId !== runId) return nativeOwner === runId;
    await backgroundTrackingRepository.clear(runId);
    return true;
  });
  if (ownsTask) await stopNativeTask();
  if (ownsTask) nativeOwner = null;
}

export async function reportBackgroundLocationError(message: string): Promise<void> {
  const session = await enqueue(async () => {
    const current = await backgroundTrackingRepository.get();
    if (current) {
      closing.add(current.runId);
      await backgroundTrackingRepository.setError(current.runId, message).catch(() => undefined);
    }
    return current;
  }).catch(() => null);
  if (session) {
    await pauseRun(session.runId).catch(() => undefined);
    publish({runId: session.runId, error: message});
  }
  // A failed task must not keep saving after a storage or permission error.
  try {
    await stopNativeTask();
  } catch { /* The durable error blocks further samples; the next explicit start retries native cleanup. */ }
}

export function processBackgroundLocations(locations: Location.LocationObject[]): Promise<void> {
  const receivedAt = Date.now() / 1000;
  return enqueue(async () => {
    const db = await getDatabase();
    const session = await backgroundTrackingRepository.get(db);
    if (!session || session.error || closing.has(session.runId)) return;
    // OS-delivered batches may contain older samples; preserve timestamp order and a bounded freshness window.
    for (const nativeLocation of [...locations].sort((a, b) => a.timestamp - b.timestamp)) {
      const raw = toRawGpsLocation(nativeLocation);
      if (raw.timestamp < session.startedAt) continue;
      let event: BackgroundEvent | null = null;
      await db.withExclusiveTransactionAsync(async (transaction) => {
        const active = await backgroundTrackingRepository.get(transaction);
        const run = await runRepository.get(session.runId, transaction);
        if (!active || active.startedAt !== session.startedAt || active.error || !run || run.state !== 'running') return;
        const last = await runLocationRepository.getLast(session.runId, transaction);
        const sequence = last ? last.sequence + 1 : 0;
        const previous: ValidGpsLocation | null = last && last.sequence >= session.firstSequence
          && last.accuracy !== null ? { latitude: last.latitude, longitude: last.longitude,
          accuracy: last.accuracy, altitude: last.altitude, speed: last.speed,
          timestamp: last.recordedAt, validated: true } : null;
        const result: GpsFilterResult = last && raw.timestamp <= last.recordedAt
          ? {accepted: false, reason: 'out_of_order'}
          : await persistRunLocation({runId: session.runId, sequence, raw, previous,
            receivedAt, maxAgeSeconds: GPS_CONFIG.MAX_BACKGROUND_LOCATION_AGE_SECONDS}, transaction);
        event = {runId: session.runId, raw, result, savedLocationCount: sequence + (result.accepted ? 1 : 0)};
      });
      if (event) publish(event);
    }
  }).catch(() => reportBackgroundLocationError('백그라운드 위치 기록을 저장하지 못했어요. 위치 추적을 다시 시작해 주세요.'));
}
