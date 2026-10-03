import { runRepository } from '@/database/repositories/runRepository';
import { runLocationRepository } from '@/database/repositories/runLocationRepository';
import { ensureCurrentWeeklyGoal } from '@/features/training/services/weeklyGoalService';
import { getCalendarWeek } from '@/features/home/utils/calendarWeek';

export async function loadRunResult(runId: string, now = new Date()) {
  const run = await runRepository.get(runId);
  if (!run || run.state !== 'completed') throw new Error('완료한 러닝 기록을 찾을 수 없어요.');
  const week = getCalendarWeek(now);
  const [locations, weeklyGoal, completedRuns] = await Promise.all([
    runLocationRepository.list(runId), ensureCurrentWeeklyGoal(now),
    runRepository.countCompletedInPeriod(week.startSeconds, week.endSeconds),
  ]);
  return { run, coordinates: locations.map(({ latitude, longitude }) => ({ latitude, longitude })),
    weeklyTarget: weeklyGoal.targetRuns, weeklyCompletedRuns: completedRuns };
}
