// Distances: meters; durations/timestamps: seconds (Unix); pace: seconds/km; speed: m/s.
export type Run = {
  id: string;
  source: string;
  goalType: 'none' | 'time' | 'distance';
  targetDistanceMeters: number | null;
  targetDurationSeconds: number | null;
  startedAt: number;
  endedAt: number | null;
  state: 'running' | 'paused' | 'completed';
  distanceMeters: number;
  activeDurationSeconds: number;
  pausedDurationSeconds: number;
  pausedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type RunLocation = {
  id: string;
  runId: string;
  sequence: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  recordedAt: number;
};

// Nullable only for GPS rows recorded before split support was introduced.
export type RunLocationMetrics = {
  cumulativeDistanceMeters: number | null;
  activeDurationSeconds: number | null;
};

export type Fastest5KRecord = Run & { recordDurationSeconds: number };

export type RunSplit = {
  id: string;
  runId: string;
  splitNumber: number;
  distanceMeters: number;
  durationSeconds: number;
  paceSecondsPerKm: number | null;
};

export type TrainingProgress = {
  planId: string;
  sessionId: string;
  status: 'pending' | 'completed';
  completedRunId: string | null;
  completedAt: number | null;
};

export type WeeklyGoal = {
  weekStartDate: string;
  targetRuns: number;
  createdAt: number;
  updatedAt: number;
};

export type AppSettings = {
  distance_unit: 'km' | 'mi';
  default_weekly_target: number;
  onboarding_completed: boolean;
};
