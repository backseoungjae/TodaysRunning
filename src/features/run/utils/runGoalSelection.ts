import type { RunGoal } from '../types/runGoalTypes';
import { FREE_RUN_GOAL } from '../types/runGoalTypes';
import { readTrainingSelection, type TrainingRunParams } from './trainingSelection';

export function readRunGoal(params: TrainingRunParams): RunGoal | null {
  if (params.planId !== undefined || params.sessionId !== undefined) {
    const selection = readTrainingSelection(params);
    return selection.status === 'selected' ? {
      goalType: selection.session.goalType,
      targetDurationSeconds: selection.session.targetDurationSeconds ?? null,
      targetDistanceMeters: selection.session.targetDistanceMeters ?? null,
    } : null;
  }
  if ([params.goalType, params.targetDurationSeconds, params.targetDistanceMeters].some(Array.isArray)) return null;
  const type = params.goalType ?? 'none';
  if (type === 'none') return params.targetDurationSeconds === undefined && params.targetDistanceMeters === undefined ? FREE_RUN_GOAL : null;
  const target = Number(type === 'time' ? params.targetDurationSeconds : params.targetDistanceMeters);
  if (!Number.isFinite(target) || target <= 0 || (type !== 'time' && type !== 'distance')) return null;
  if (type === 'time' && params.targetDistanceMeters !== undefined || type === 'distance' && params.targetDurationSeconds !== undefined) return null;
  return { goalType: type, targetDurationSeconds: type === 'time' ? target : null, targetDistanceMeters: type === 'distance' ? target : null };
}

export function getRunGoalParams(goal: RunGoal) {
  return { goalType: goal.goalType,
    ...(goal.goalType === 'time' ? { targetDurationSeconds: String(goal.targetDurationSeconds) } : {}),
    ...(goal.goalType === 'distance' ? { targetDistanceMeters: String(goal.targetDistanceMeters) } : {}) };
}
