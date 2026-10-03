import { runLocationRepository } from '@/database/repositories/runLocationRepository';
import { runSplitRepository } from '@/database/repositories/runSplitRepository';
import { runRepository } from '@/database/repositories/runRepository';
import { getCalendarWeek } from '@/features/home/utils/calendarWeek';
import { calculatePaceSecondsPerKm } from '@/features/run/utils/calculatePace';

import { calculatePersonalRecords } from '../utils/calculatePersonalRecords';

export async function loadActivity(weekOffset = 0, now = new Date()) {
  const selectedDate = new Date(now);
  selectedDate.setDate(selectedDate.getDate() + weekOffset * 7);
  const week = getCalendarWeek(selectedDate);
  // GPS coordinates belong to the detail request; records use summaries and stored splits.
  const [runs, fastest5K, totals] = await Promise.all([
    runRepository.listCompleted(),
    runRepository.findFastest5K(),
    runRepository.summarizeCompletedInPeriod(week.startSeconds, week.endSeconds),
  ]);
  return { runs, week, personalRecords: calculatePersonalRecords(runs, fastest5K), statistics: { ...totals,
    averagePaceSeconds: calculatePaceSecondsPerKm(totals.distanceMeters, totals.activeDurationSeconds) } };
}

export async function loadActivityDetail(runId: string) {
  const run = await runRepository.get(runId);
  if (!run || run.state !== 'completed') throw new Error('완료한 러닝 기록을 찾을 수 없어요.');
  const [locations, splits] = await Promise.all([runLocationRepository.list(runId), runSplitRepository.list(runId)]);
  return { run, splits, coordinates: locations.map(({ latitude, longitude }) => ({ latitude, longitude })),
    averagePaceSeconds: calculatePaceSecondsPerKm(run.distanceMeters, run.activeDurationSeconds) };
}
