import type { SQLiteDatabase } from 'expo-sqlite';

import { settingsRepository } from '@/database/repositories/settingsRepository';
import { weeklyGoalRepository } from '@/database/repositories/weeklyGoalRepository';
import { withDatabaseTransaction } from '@/database/withDatabaseTransaction';
import { getCalendarWeek } from '@/features/home/utils/calendarWeek';

export const MAX_WEEKLY_TARGET = 7;

export function isCurrentGoalWeek(dateKey: string | null) {
  return dateKey === getCalendarWeek(new Date()).dateKey;
}

export async function ensureCurrentWeeklyGoal(now = new Date(), db?: SQLiteDatabase) {
  const week = getCalendarWeek(now);
  const operation = async (connection: SQLiteDatabase) => {
    const existing = await weeklyGoalRepository.get(week.dateKey, connection);
    if (existing) return existing;
    const targetRuns = await settingsRepository.get('default_weekly_target', connection) ?? 3;
    const timestamp = now.getTime() / 1000;
    const goal = { weekStartDate: week.dateKey, targetRuns, createdAt: timestamp, updatedAt: timestamp };
    await weeklyGoalRepository.createIfMissing(goal, connection);
    return (await weeklyGoalRepository.get(week.dateKey, connection))!;
  };
  return db ? operation(db) : withDatabaseTransaction(operation);
}

export async function updateWeeklyTarget(targetRuns: number, now = new Date()) {
  if (!Number.isInteger(targetRuns) || targetRuns < 0 || targetRuns > MAX_WEEKLY_TARGET) throw new Error(`주간 목표는 0~${MAX_WEEKLY_TARGET}회로 선택해 주세요.`);
  return withDatabaseTransaction(async (db) => {
    // Set the default for future weeks; only this calendar week's snapshot is changed.
    await settingsRepository.set('default_weekly_target', targetRuns, db);
    const goal = await ensureCurrentWeeklyGoal(now, db);
    const next = { ...goal, targetRuns, updatedAt: now.getTime() / 1000 };
    await weeklyGoalRepository.update(next, db);
    return next;
  });
}
