import type { SQLiteDatabase } from 'expo-sqlite';

import type { Run } from '@/database/databaseTypes';
import { runRepository } from '@/database/repositories/runRepository';
import { trainingRepository } from '@/database/repositories/trainingRepository';

import { beginnerPlan } from '../data/beginnerPlan';

export type TrainingRunSelection = { planId: string; sessionId: string };

export function validateTrainingRun(selection: TrainingRunSelection, goal: Pick<Run, 'goalType' | 'targetDurationSeconds' | 'targetDistanceMeters'>) {
  const session = selection.planId === beginnerPlan.id ? beginnerPlan.sessions.find((entry) => entry.id === selection.sessionId) : undefined;
  if (!session || goal.goalType !== session.goalType
    || goal.targetDurationSeconds !== (session.targetDurationSeconds ?? null)
    || goal.targetDistanceMeters !== (session.targetDistanceMeters ?? null)) throw new Error('선택한 플랜 목표를 확인해 주세요.');
}

export async function completeRunTraining(run: Run, db: SQLiteDatabase) {
  if (run.state !== 'completed' || run.endedAt === null) return;
  const selection = await runRepository.getTrainingSession(run.id, db);
  if (selection) await trainingRepository.complete(selection.planId, selection.sessionId, run.id, run.endedAt, db);
}
