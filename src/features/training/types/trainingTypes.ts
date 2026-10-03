type SessionDetails = {
  id: string;
  week: number;
  day: number;
  title: string;
  description: string;
};

export type TrainingSession = SessionDetails & (
  | { goalType: 'time'; targetDurationSeconds: number; targetDistanceMeters?: never }
  | { goalType: 'distance'; targetDistanceMeters: number; targetDurationSeconds?: never }
);

export type TrainingPlan = {
  id: string;
  title: string;
  description: string;
  sessions: readonly TrainingSession[];
};
