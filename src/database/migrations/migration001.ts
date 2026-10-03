import type { SQLiteDatabase } from 'expo-sqlite';

export async function migration001(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE runs (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      goal_type TEXT NOT NULL CHECK (goal_type IN ('none', 'time', 'distance')),
      target_distance_meters REAL CHECK (target_distance_meters > 0),
      target_duration_seconds REAL CHECK (target_duration_seconds > 0),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      state TEXT NOT NULL CHECK (state IN ('running', 'paused', 'completed')),
      distance_meters REAL NOT NULL DEFAULT 0 CHECK (distance_meters >= 0),
      active_duration_seconds REAL NOT NULL DEFAULT 0 CHECK (active_duration_seconds >= 0),
      paused_duration_seconds REAL NOT NULL DEFAULT 0 CHECK (paused_duration_seconds >= 0),
      paused_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX idx_runs_started_at ON runs(started_at);
    CREATE INDEX idx_runs_state ON runs(state);

    CREATE TABLE run_locations (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL CHECK (sequence >= 0),
      latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
      longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      altitude REAL,
      accuracy REAL CHECK (accuracy >= 0),
      speed REAL CHECK (speed >= 0),
      recorded_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_run_locations_run_sequence ON run_locations(run_id, sequence);

    CREATE TABLE run_splits (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      split_number INTEGER NOT NULL CHECK (split_number >= 1),
      distance_meters REAL NOT NULL CHECK (distance_meters > 0),
      duration_seconds REAL NOT NULL CHECK (duration_seconds >= 0),
      pace_seconds_per_km REAL CHECK (pace_seconds_per_km >= 0)
    );
    CREATE UNIQUE INDEX idx_run_splits_run_number ON run_splits(run_id, split_number);

    CREATE TABLE training_progress (
      plan_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
      completed_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
      completed_at INTEGER,
      PRIMARY KEY (plan_id, session_id)
    );
    CREATE TABLE weekly_goals (
      week_start_date TEXT PRIMARY KEY NOT NULL,
      target_runs INTEGER NOT NULL CHECK (target_runs >= 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY NOT NULL CHECK (key IN ('distance_unit', 'default_weekly_target', 'onboarding_completed')),
      value TEXT NOT NULL,
      CHECK (
        (key = 'distance_unit' AND value IN ('"km"', '"mi"')) OR
        (key = 'default_weekly_target' AND json_valid(value) AND json_type(value) = 'integer' AND CAST(value AS INTEGER) >= 0) OR
        (key = 'onboarding_completed' AND value IN ('true', 'false'))
      )
    );
    INSERT INTO app_settings (key, value) VALUES
      ('distance_unit', '"km"'),
      ('default_weekly_target', '3'),
      ('onboarding_completed', 'false');
  `);
}
