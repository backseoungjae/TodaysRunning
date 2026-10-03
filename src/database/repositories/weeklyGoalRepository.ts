import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../database';
import type { WeeklyGoal } from '../databaseTypes';

const selectColumns = `
  week_start_date AS weekStartDate,
  target_runs AS targetRuns,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

// Optional connection supports composing repositories inside a caller-owned transaction.
export const weeklyGoalRepository = {
  async createIfMissing(value: WeeklyGoal, db?: SQLiteDatabase): Promise<void> {
    const connection = db ?? (await getDatabase());
    await connection.runAsync(
      `INSERT INTO weekly_goals (week_start_date, target_runs, created_at, updated_at)
       VALUES (?, ?, ?, ?) ON CONFLICT(week_start_date) DO NOTHING`,
      value.weekStartDate, value.targetRuns, value.createdAt, value.updatedAt,
    );
  },
  async create(value: WeeklyGoal, db?: SQLiteDatabase): Promise<void> {
    const connection = db ?? (await getDatabase());
    await connection.runAsync(
      'INSERT INTO weekly_goals (week_start_date, target_runs, created_at, updated_at) VALUES (?, ?, ?, ?)',
      value.weekStartDate,
      value.targetRuns,
      value.createdAt,
      value.updatedAt,
    );
  },

  async get(weekStartDate: string, db?: SQLiteDatabase): Promise<WeeklyGoal | null> {
    const connection = db ?? (await getDatabase());
    return connection.getFirstAsync<WeeklyGoal>(
      `SELECT ${selectColumns} FROM weekly_goals WHERE week_start_date = ?`, weekStartDate,
    );
  },

  async list(db?: SQLiteDatabase): Promise<WeeklyGoal[]> {
    const connection = db ?? (await getDatabase());
    return connection.getAllAsync<WeeklyGoal>(
      `SELECT ${selectColumns} FROM weekly_goals ORDER BY week_start_date DESC`,
    );
  },

  async update(value: WeeklyGoal, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync(
      'UPDATE weekly_goals SET target_runs = ?, updated_at = ? WHERE week_start_date = ?',
      value.targetRuns,
      value.updatedAt,
      value.weekStartDate,
    );
    return result.changes > 0;
  },

  async delete(weekStartDate: string, db?: SQLiteDatabase): Promise<boolean> {
    const connection = db ?? (await getDatabase());
    const result = await connection.runAsync('DELETE FROM weekly_goals WHERE week_start_date = ?', weekStartDate);
    return result.changes > 0;
  },
};
