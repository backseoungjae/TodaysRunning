import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { TrainingSession } from '@/features/training/types/trainingTypes';

import { useRunStore } from '../store/runStore';

import { getLocationPermissionStatus } from '@/shared/services/locationService';

import { createRunLocationTracker, type RunLocationState } from '../services/runLocationTracker';
import { finishRun } from '../services/runLifecycleService';
import type { RunGoal } from '../types/runGoalTypes';
import { refreshRunRuntime, synchronizeRunRuntime } from '../services/runRuntimeService';

export function useRunLocation(options: { runId?: string; session?: TrainingSession; goal?: RunGoal; enabled?: boolean } = {}) {
  const [state, setState] = useState<RunLocationState | null>(null);
  const focused = useRef(false);
  const desired = useRef(true);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const tracker = useMemo(() => createRunLocationTracker({
    runId: options.runId,
    session: options.session,
    goal: options.goal,
    async onRunReady(run) {
      const store = useRunStore.getState();
      if (store.runId !== run.id) {
        store.initializeRun({ runId: run.id, goalType: run.goalType,
          targetDistanceMeters: run.targetDistanceMeters, targetDurationSeconds: run.targetDurationSeconds });
      }
      await synchronizeRunRuntime(run);
      const current = useRunStore.getState();
      if (current.status === 'completed') throw new Error('이미 종료한 러닝입니다. 새 러닝을 시작해 주세요.');
      if (current.status === 'paused') current.resumeRun();
      else current.startRun();
    },
    onValidLocation(runId, location, distanceMeters) {
      const store = useRunStore.getState();
      if (store.runId === runId) store.updateLocation(location, distanceMeters);
    },
    onStopping(runId) {
      const store = useRunStore.getState();
      if (store.runId === runId) store.stopTimer();
    },
    onStopped(runId) {
      const store = useRunStore.getState();
      if (store.runId === runId) store.pauseRun();
    },
  }), [options.runId, options.session, options.goal]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    foreground.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const unsubscribe = tracker.subscribe(setState);
    setState(tracker.getState());
    if (options.enabled !== false && desired.current && foreground.current) void tracker.start();
    const subscription = AppState.addEventListener('change', (appState) => {
      foreground.current = appState === 'active';
      if (!foreground.current) {
        if (!tracker.getState().backgroundEnabled) void tracker.stop();
      }
      else if (tracker.getState().backgroundEnabled) {
        useRunStore.getState().refreshElapsedSeconds();
        const runId = tracker.getState().runId;
        if (runId) void refreshRunRuntime(runId).catch(() => { /* A tracking/storage error is shown by the tracker. */ });
        void getLocationPermissionStatus().then(async (permission) => {
          if (!permission.background?.granted && focused.current && desired.current && foreground.current) {
            await tracker.stop();
            if (!tracker.getState().backgroundEnabled && focused.current && desired.current && foreground.current) await tracker.start();
          }
        }).catch(() => { /* Native tracking errors are reported by the Location Task. */ });
      } else if (options.enabled !== false && desired.current) void tracker.stop().then(() => {
        if (focused.current && desired.current && foreground.current) void tracker.start();
      });
    });
    return () => {
      focused.current = false;
      unsubscribe();
      subscription.remove();
      if (foreground.current || !tracker.getState().backgroundEnabled) void tracker.stop();
    };
  }, [tracker, options.enabled]));

  async function start() {
    desired.current = true;
    await tracker.stop();
    if (!tracker.getState().backgroundEnabled && options.enabled !== false && focused.current && desired.current && foreground.current) await tracker.start();
  }
  async function stop() {
    desired.current = false;
    await tracker.stop();
    return !tracker.getState().backgroundEnabled && tracker.getState().status === 'stopped';
  }
  async function finish() {
    if (useRunStore.getState().status !== 'paused' || !await stop()) return false;
    const store = useRunStore.getState();
    if (!store.runId || store.runId !== tracker.getState().runId) return false;
    await finishRun(store.runId);
    store.finishRun();
    return true;
  }
  return { ...(state ?? tracker.getState()), start, stop, finish };
}
