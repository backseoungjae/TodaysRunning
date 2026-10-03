import { create } from 'zustand';

import type { Run } from '@/database/databaseTypes';

import type { ValidGpsLocation } from '../types/gpsTypes';
import { calculateActiveDurationSeconds } from '../utils/calculateActiveDuration';

export type RunStatus = 'idle' | 'running' | 'paused' | 'completed';
export type RunCoordinate = { latitude: number; longitude: number };
export type RunInitialization = Pick<Run, 'goalType' | 'targetDistanceMeters' | 'targetDurationSeconds'> & { runId: string };

type RunSessionState = {
  runId: string | null;
  status: RunStatus;
  goalType: Run['goalType'];
  targetDistanceMeters: number | null;
  targetDurationSeconds: number | null;
  distanceMeters: number;
  elapsedSeconds: number;
  activeStartedAtMs: number | null;
  elapsedSecondsAtResume: number;
  currentPaceSeconds: number | null;
  currentLocation: ValidGpsLocation | null;
  routeCoordinates: readonly RunCoordinate[];
  isMapFollowing: boolean;
};
type RunActions = {
  initializeRun: (run: RunInitialization) => void;
  startRun: () => void;
  pauseRun: () => void;
  resumeRun: () => void;
  updateLocation: (location: ValidGpsLocation, distanceFromPreviousMeters: number) => void;
  updateElapsedSeconds: (seconds: number) => void;
  refreshElapsedSeconds: () => void;
  stopTimer: () => void;
  updateCurrentPaceSeconds: (seconds: number | null) => void;
  finishRun: () => void;
  resetRun: () => void;
  setMapFollowing: (following: boolean) => void;
};
const initialState = (): RunSessionState => ({
  runId: null, status: 'idle', goalType: 'none', targetDistanceMeters: null,
  targetDurationSeconds: null, distanceMeters: 0, elapsedSeconds: 0,
  activeStartedAtMs: null, elapsedSecondsAtResume: 0,
  currentPaceSeconds: null, currentLocation: null, routeCoordinates: [], isMapFollowing: true,
});

function elapsedNow(state: RunSessionState): number {
  return Math.max(state.elapsedSeconds, calculateActiveDurationSeconds(
    state.elapsedSecondsAtResume, state.activeStartedAtMs, Date.now(),
  ));
}

// Runtime only. Repositories remain responsible for permanent records.
export const useRunStore = create<RunSessionState & RunActions>()((set) => ({
  ...initialState(),
  initializeRun: (run) => {
    if (!run.runId.trim()) throw new Error('러닝 ID가 필요합니다.');
    const target = run.goalType === 'distance' ? run.targetDistanceMeters : run.targetDurationSeconds;
    if (run.goalType !== 'none' && (target === null || !Number.isFinite(target) || target <= 0)) {
      throw new Error('러닝 목표는 0보다 큰 값이어야 합니다.');
    }
    set({ ...initialState(), runId: run.runId, goalType: run.goalType,
      targetDistanceMeters: run.goalType === 'distance' ? run.targetDistanceMeters : null,
      targetDurationSeconds: run.goalType === 'time' ? run.targetDurationSeconds : null });
  },
  startRun: () => set((state) => state.runId && state.status === 'idle' ? { status: 'running', activeStartedAtMs: Date.now(), elapsedSecondsAtResume: state.elapsedSeconds } : state),
  pauseRun: () => set((state) => state.status === 'running' ? { status: 'paused', currentPaceSeconds: null, elapsedSeconds: elapsedNow(state), activeStartedAtMs: null } : state),
  resumeRun: () => set((state) => state.status === 'paused' ? { status: 'running', currentPaceSeconds: null, activeStartedAtMs: Date.now(), elapsedSecondsAtResume: state.elapsedSeconds } : state),
  updateLocation: (location, distance) => set((state) => {
    if (state.status !== 'running' || location.validated !== true || !Number.isFinite(distance) || distance < 0
      || !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90
      || !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180
      || !Number.isFinite(location.timestamp) || location.timestamp <= 0
      || (state.currentLocation && location.timestamp <= state.currentLocation.timestamp)) return state;
    return { currentLocation: { ...location }, distanceMeters: state.distanceMeters + distance,
      routeCoordinates: [...state.routeCoordinates, { latitude: location.latitude, longitude: location.longitude }] };
  }),
  // Timer and pace services can supply these values without placing their calculations in the store.
  updateElapsedSeconds: (seconds) => set((state) => state.status === 'running' && Number.isFinite(seconds)
    && seconds >= state.elapsedSeconds ? { elapsedSeconds: seconds,
      elapsedSecondsAtResume: seconds, activeStartedAtMs: state.activeStartedAtMs === null ? null : Date.now() } : state),
  refreshElapsedSeconds: () => set((state) => {
    if (state.status !== 'running' || state.activeStartedAtMs === null) return state;
    const elapsedSeconds = elapsedNow(state);
    return elapsedSeconds === state.elapsedSeconds ? state : { elapsedSeconds };
  }),
  // Freeze the clock before draining GPS writes; accepted samples already received can still be saved.
  stopTimer: () => set((state) => state.status === 'running' && state.activeStartedAtMs !== null
    ? { elapsedSeconds: elapsedNow(state), activeStartedAtMs: null } : state),
  updateCurrentPaceSeconds: (seconds) => set((state) => state.status === 'running'
    && (seconds === null || (Number.isFinite(seconds) && seconds > 0)) ? { currentPaceSeconds: seconds } : state),
  finishRun: () => set((state) => state.status === 'running' || state.status === 'paused'
    ? { status: 'completed', currentPaceSeconds: null, elapsedSeconds: elapsedNow(state), activeStartedAtMs: null } : state),
  resetRun: () => set(initialState()),
  setMapFollowing: (following) => set({ isMapFollowing: following }),
}));
