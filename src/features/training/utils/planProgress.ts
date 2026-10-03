import type { TrainingProgress } from '@/database/databaseTypes';

import type { TrainingPlan, TrainingSession } from '../types/trainingTypes';

export function getPlanProgress(plan: TrainingPlan, progress: readonly TrainingProgress[]) {
  const sessionIds = new Set(plan.sessions.map((session) => session.id));
  const completedSessionIds = new Set(progress
    .filter((entry) => entry.planId === plan.id && entry.status === 'completed' && sessionIds.has(entry.sessionId))
    .map((entry) => entry.sessionId));
  const nextSession = plan.sessions.find((session) => !completedSessionIds.has(session.id)) ?? null;
  return { completedSessionIds, completedCount: completedSessionIds.size, totalCount: plan.sessions.length, nextSession };
}

export function formatSessionGoal(session: TrainingSession): string {
  return session.goalType === 'time'
    ? `${session.targetDurationSeconds / 60}분`
    : `${session.targetDistanceMeters / 1000}km`;
}
