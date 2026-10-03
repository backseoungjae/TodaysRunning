import { runRepository } from '@/database/repositories/runRepository';
import { trainingRepository } from '@/database/repositories/trainingRepository';
import { ensureCurrentWeeklyGoal } from '@/features/training/services/weeklyGoalService';
import { beginnerPlan } from '@/features/training/data/beginnerPlan';
import { getPlanProgress } from '@/features/training/utils/planProgress';

import { getCalendarWeek } from '../utils/calendarWeek';

export async function loadHomeData(now = new Date()) {
  const week = getCalendarWeek(now);
  const [progress, goal, completedRuns] = await Promise.all([
    trainingRepository.list(beginnerPlan.id),
    ensureCurrentWeeklyGoal(now),
    runRepository.countCompletedInPeriod(week.startSeconds, week.endSeconds),
  ]);
  return {
    planProgress: getPlanProgress(beginnerPlan, progress),
    weeklyTarget: goal.targetRuns,
    weeklyCompletedRuns: completedRuns,
  };
}
