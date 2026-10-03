import type { Run } from '@/database/databaseTypes';
import { runRepository } from '@/database/repositories/runRepository';
import { withDatabaseTransaction } from '@/database/withDatabaseTransaction';
import { completeRunTraining, validateTrainingRun, type TrainingRunSelection } from '@/features/training/services/trainingCompletionService';

import type { RunGoal } from '../types/runGoalTypes';
import { saveRunSplits } from './runSplitService';

export async function createRun(goal: RunGoal, source = 'free', now = Date.now() / 1000, training?: TrainingRunSelection) {
  const target = goal.goalType === 'time' ? goal.targetDurationSeconds : goal.targetDistanceMeters;
  if (goal.goalType !== 'none' && (target === null || !Number.isFinite(target) || target <= 0)) throw new Error('러닝 목표를 확인해 주세요.');
  if (training) validateTrainingRun(training, goal);
  return withDatabaseTransaction(async (db) => {
    const run = { ...goal, id: await runRepository.generateId(db), source: training ? 'training' : source, startedAt: now,
      endedAt: null, state: 'running' as const, distanceMeters: 0, activeDurationSeconds: 0,
      pausedDurationSeconds: 0, pausedAt: null, createdAt: now, updatedAt: now };
    await runRepository.create(run, db);
    if (training) await runRepository.setTrainingSession(run.id, training, db);
    return run;
  });
}

export async function pauseRun(runId: string, now = Date.now() / 1000) {
  return withDatabaseTransaction(async (db) => {
    const run = await runRepository.get(runId, db);
    if (!run) throw new Error('진행 중인 러닝을 찾을 수 없어요.');
    if (run.state === 'paused' || run.state === 'completed') return run;
    const pausedAt = Math.max(run.startedAt, now);
    const next = { ...run, state: 'paused' as const, pausedAt,
      activeDurationSeconds: Math.max(run.activeDurationSeconds, pausedAt - run.startedAt - run.pausedDurationSeconds), updatedAt: pausedAt };
    await runRepository.update(next, db);
    return next;
  });
}

export async function resumeRun(runId: string, now = Date.now() / 1000) {
  return withDatabaseTransaction(async (db) => {
    const run = await runRepository.get(runId, db);
    if (!run || run.state === 'completed') throw new Error('진행 중인 러닝을 찾을 수 없어요.');
    if (run.state === 'running') return run;
    const next = { ...run, state: 'running' as const, pausedAt: null,
      pausedDurationSeconds: run.pausedDurationSeconds + Math.max(0, now - (run.pausedAt ?? now)), updatedAt: now };
    await runRepository.update(next, db);
    return next;
  });
}

export async function finishRun(runId: string, now = Date.now() / 1000) {
  return withDatabaseTransaction(async (db) => {
    const run = await runRepository.get(runId, db);
    if (!run) throw new Error('러닝 기록을 찾을 수 없어요.');
    if (run.state === 'completed') return run; // Safe retry after a successful commit.
    if (run.state !== 'paused') throw new Error('일시정지 후 러닝을 종료해 주세요.');
    const next = { ...run, state: 'completed' as const, endedAt: now, pausedAt: null,
      pausedDurationSeconds: run.pausedDurationSeconds + Math.max(0, now - (run.pausedAt ?? now)), updatedAt: now };
    await runRepository.update(next, db);
    await saveRunSplits(runId, db);
    await completeRunTraining(next, db);
    return next;
  });
}

export function getRunActiveDuration(run: Run, now = Date.now() / 1000): number {
  return run.state === 'running' ? Math.max(run.activeDurationSeconds, now - run.startedAt - run.pausedDurationSeconds) : run.activeDurationSeconds;
}
