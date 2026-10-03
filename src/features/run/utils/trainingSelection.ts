import { beginnerPlan } from '@/features/training/data/beginnerPlan';
import type { TrainingSession } from '@/features/training/types/trainingTypes';

export function getTrainingRunParams(session: TrainingSession) {
  return {
    planId: beginnerPlan.id,
    sessionId: session.id,
    goalType: session.goalType,
    targetDurationSeconds: session.goalType === 'time' ? String(session.targetDurationSeconds) : undefined,
    targetDistanceMeters: session.goalType === 'distance' ? String(session.targetDistanceMeters) : undefined,
  };
}

export type TrainingRunParams = {
  [K in keyof ReturnType<typeof getTrainingRunParams>]?: string | string[];
};

type TrainingSelection =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'selected'; session: TrainingSession; planId: string };

export function readTrainingSelection(params: TrainingRunParams): TrainingSelection {
  const values = [params.planId, params.sessionId, params.goalType, params.targetDurationSeconds, params.targetDistanceMeters];
  if (values.every((value) => value === undefined)) return { status: 'none' };
  if (values.some(Array.isArray) || params.planId !== beginnerPlan.id) return { status: 'invalid' };
  const session = beginnerPlan.sessions.find((entry) => entry.id === params.sessionId);
  if (!session || params.goalType !== session.goalType) return { status: 'invalid' };
  const expected = getTrainingRunParams(session);
  if (params.targetDurationSeconds !== expected.targetDurationSeconds || params.targetDistanceMeters !== expected.targetDistanceMeters) {
    return { status: 'invalid' };
  }
  return { status: 'selected', session, planId: beginnerPlan.id };
}
