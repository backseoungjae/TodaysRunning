import type { Run } from '@/database/databaseTypes';

export type RunGoal = Pick<Run, 'goalType' | 'targetDistanceMeters' | 'targetDurationSeconds'>;
export const FREE_RUN_GOAL: RunGoal = { goalType: 'none', targetDistanceMeters: null, targetDurationSeconds: null };
export const TIME_PRESETS_MINUTES = [10, 20, 30, 45, 60] as const;
export const DISTANCE_PRESETS_KM = [1, 3, 5, 10] as const;
