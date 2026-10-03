import './backgroundLocationTask';

import { backgroundTrackingRepository } from '@/database/repositories/backgroundTrackingRepository';
import type { Run } from '@/database/databaseTypes';
import { runLocationRepository } from '@/database/repositories/runLocationRepository';
import { runRepository } from '@/database/repositories/runRepository';
import type { TrainingSession } from '@/features/training/types/trainingTypes';
import { beginnerPlan } from '@/features/training/data/beginnerPlan';
import { startLocationTracking, stopLocationTracking } from '@/shared/services/locationService';
import type { LocationTrackingHandle, RawGpsLocation } from '@/shared/types/locationTypes';

import type { GpsRejectionReason, ValidGpsLocation } from '../types/gpsTypes';
import { startBackgroundTracking, stopBackgroundTracking, subscribeBackgroundLocations } from './backgroundLocationService';
import { persistRunLocation } from './runLocationPersistence';
import { createRun, pauseRun, resumeRun } from './runLifecycleService';
import { FREE_RUN_GOAL, type RunGoal } from '../types/runGoalTypes';

export type RunLocationState = {
  status: 'idle' | 'starting' | 'tracking' | 'stopping' | 'stopped' | 'error';
  runId: string | null;
  rawLocation: RawGpsLocation | null;
  validLocation: ValidGpsLocation | null;
  rejectionReason: GpsRejectionReason | null;
  savedLocationCount: number;
  distanceFromPreviousMeters: number;
  error: string | null;
  backgroundEnabled: boolean;
  backgroundNotice: string | null;
};

export function createRunLocationTracker(options: {
  runId?: string;
  session?: TrainingSession;
  goal?: RunGoal;
  onChange?: (state: RunLocationState) => void;
  onRunReady?: (run: Run) => void | Promise<void>;
  onValidLocation?: (runId: string, location: ValidGpsLocation, distanceMeters: number) => void;
  onStopping?: (runId: string) => void;
  onStopped?: (runId: string) => void;
}) {
  let state: RunLocationState = {
    status: 'idle', runId: options.runId ?? null, rawLocation: null, validLocation: null,
    rejectionReason: null, savedLocationCount: 0, distanceFromPreviousMeters: 0, error: null, backgroundEnabled: false, backgroundNotice: null,
  };
  let unsubscribeBackground: (() => void) | null = null;
  let backgroundActive = false;
  let handle: LocationTrackingHandle | null = null;
  let generation = 0;
  let startPromise: Promise<void> | null = null;
  let stopPromise: Promise<void> | null = null;
  let writes: Promise<void> = Promise.resolve();
  let previous: ValidGpsLocation | null = null;
  let resumedAt = 0;
  let pauseRequestedAt: number | null = null;
  let sequence = 0;
  let initialized = false;
  let currentRun: Run | null = null;
  let failed = false;
  let listener = options.onChange;
  const publish = (patch: Partial<RunLocationState>) => {
    state = { ...state, ...patch };
    listener?.(state);
  };
  function fail(message: string) {
    failed = true;
    generation += 1;
    if (handle) stopLocationTracking(handle);
    handle = null;
    publish({ status: 'error', error: message });
    if (backgroundActive && state.runId) {
      void stopBackgroundTracking(state.runId).catch(() => publish({error: '위치 추적을 완전히 중지하지 못했어요. 다시 중지해 주세요.'}));
    }
    if (state.runId) {
      const id = state.runId;
      const stoppedAt = pauseRequestedAt ??= Date.now() / 1000;
      options.onStopping?.(id);
      // Save a pause after pending samples, including native tracking failures.
      writes = writes.then(async () => { await pauseRun(id, stoppedAt); options.onStopped?.(id); })
        .catch(() => publish({error: '일시정지 상태를 저장하지 못했어요. 다시 중지해 주세요.'}));
    }
  }
  async function initializeRun() {
    if (initialized) return;
    const backgroundSession = await backgroundTrackingRepository.get();
    if (backgroundSession && !backgroundSession.error && !state.runId) publish({runId: backgroundSession.runId});
    if (backgroundSession && backgroundSession.runId !== state.runId && !backgroundSession.error) {
      throw new Error('진행 중인 백그라운드 러닝이 있어요. 해당 러닝의 위치 추적을 먼저 중지해 주세요.');
    }
    if (state.runId) {
      const run = await runRepository.get(state.runId);
      if (!run || run.state === 'completed') throw new Error('위치를 저장할 진행 중인 러닝 기록을 찾을 수 없어요.');
      currentRun = run;
    } else {
      const session = options.session;
      currentRun = await createRun(options.goal ?? (session ? {
        goalType: session?.goalType ?? 'none',
        targetDistanceMeters: session?.targetDistanceMeters ?? null,
        targetDurationSeconds: session?.targetDurationSeconds ?? null,
      } : FREE_RUN_GOAL), session ? 'training' : 'free', Date.now() / 1000,
      session ? { planId: beginnerPlan.id, sessionId: session.id } : undefined);
      publish({ runId: currentRun.id });
    }
    const last = await runLocationRepository.getLast(state.runId!);
    sequence = last ? last.sequence + 1 : 0;
    publish({ savedLocationCount: sequence });
    initialized = true;
  }
  function receive(raw: RawGpsLocation, token: number) {
    if (token !== generation || failed) return;
    if (raw.timestamp < resumedAt) { publish({ rejectionReason: 'out_of_order' }); return; }
    const receivedAt = Date.now() / 1000;
    publish({ rawLocation: raw, distanceFromPreviousMeters: 0 });
    // Validate and persist in order; stop drains samples already received.
    writes = writes.then(async () => {
      if (failed) return;
      const result = await persistRunLocation({runId: state.runId!, sequence, raw, previous, receivedAt});
      if (!result.accepted) {
        publish({ rejectionReason: result.reason, distanceFromPreviousMeters: 0 });
        return;
      }
      const location = result.location;
      const runId = state.runId!;
      options.onValidLocation?.(runId, location, result.distanceFromPreviousMeters);
      sequence += 1;
      previous = location;
      publish({
        validLocation: location, savedLocationCount: sequence, rejectionReason: null,
        distanceFromPreviousMeters: result.distanceFromPreviousMeters,
      });
    }).catch(() => fail('위치 기록을 저장하지 못했어요. 추적을 중지했으니 다시 시도해 주세요.'));
  }
  function start(): Promise<void> {
    if (stopPromise) return stopPromise.then(start);
    if (startPromise) return startPromise;
    if (handle || backgroundActive) return Promise.resolve();
    const token = ++generation;
    failed = false;
    publish({
      status: 'starting', error: null, rejectionReason: null,
      rawLocation: null, validLocation: null, distanceFromPreviousMeters: 0, backgroundNotice: null,
    });
    startPromise = (async () => {
      await writes;
      await initializeRun();
      const last = await runLocationRepository.getLast(state.runId!);
      sequence = last ? last.sequence + 1 : 0;
      publish({savedLocationCount: sequence});
      if (token !== generation) return;
      const beforeResume = await runRepository.get(state.runId!);
      resumedAt = beforeResume?.state === 'paused' ? Date.now() / 1000 : 0;
      currentRun = await resumeRun(state.runId!, resumedAt || Date.now() / 1000);
      pauseRequestedAt = null;
      await options.onRunReady?.(currentRun);
      previous = null;
      unsubscribeBackground = subscribeBackgroundLocations((event) => {
        if (event.runId !== state.runId || failed) return;
        if ('error' in event) { fail(event.error); return; }
        publish({rawLocation: event.raw, savedLocationCount: event.savedLocationCount, distanceFromPreviousMeters: 0});
        if (!event.result.accepted) { publish({rejectionReason: event.result.reason}); return; }
        const result = event.result;
        options.onValidLocation?.(event.runId, result.location, result.distanceFromPreviousMeters);
        publish({validLocation: result.location, rejectionReason: null, distanceFromPreviousMeters: result.distanceFromPreviousMeters});
      });
      try {
        backgroundActive = await startBackgroundTracking(state.runId!);
      } catch {
        // Clean up before falling back, ensuring only one native source is active.
        await stopBackgroundTracking(state.runId!);
        publish({backgroundNotice: '백그라운드 추적을 사용할 수 없어 앱 사용 중에만 위치를 기록해요.'});
      }
      if (token !== generation) {
        if (backgroundActive) await stopBackgroundTracking(state.runId!);
        backgroundActive = false;
        unsubscribeBackground?.(); unsubscribeBackground = null;
        return;
      }
      publish({backgroundEnabled: backgroundActive});
      if (backgroundActive) { publish({status: 'tracking'}); return; }
      unsubscribeBackground?.(); unsubscribeBackground = null;
      const subscription = await startLocationTracking(
        (raw) => receive(raw, token),
        () => fail('위치 신호를 받을 수 없어요. 위치 권한과 기기의 위치 서비스를 확인해 주세요.'),
      );
      // A stop/unmount may happen while the native subscription is still being acquired.
      if (token !== generation) { stopLocationTracking(subscription); return; }
      handle = subscription;
      publish({ status: 'tracking' });
    })().catch((error: unknown) => {
      if (token === generation) fail(error instanceof Error ? error.message : '위치 추적을 시작하지 못했어요.');
    }).finally(() => { startPromise = null; });
    return startPromise;
  }
  function stop(): Promise<void> {
    if (stopPromise) return stopPromise;
    generation += 1;
    const stoppedAt = pauseRequestedAt ??= Date.now() / 1000;
    if (state.runId) options.onStopping?.(state.runId);
    if (handle) stopLocationTracking(handle);
    handle = null;
    if (state.status !== 'error') publish({ status: 'stopping' });
    stopPromise = (async () => {
      await startPromise;
      if (backgroundActive && state.runId) await stopBackgroundTracking(state.runId);
      backgroundActive = false;
      unsubscribeBackground?.(); unsubscribeBackground = null;
      publish({backgroundEnabled: false});
      await writes;
      if (state.runId) await pauseRun(state.runId, stoppedAt);
      previous = null;
      publish({ status: 'stopped', distanceFromPreviousMeters: 0, error: null });
      if (state.runId) options.onStopped?.(state.runId);
    })().catch(() => fail('위치 추적을 완전히 중지하지 못했어요. 다시 중지해 주세요.')).finally(() => { stopPromise = null; });
    return stopPromise;
  }
  return {
    start, stop, getState: () => state,
    subscribe(onChange: (next: RunLocationState) => void) {
      listener = onChange;
      return () => { if (listener === onChange) listener = undefined; };
    },
  };
}
