// Timestamps are milliseconds; accumulated duration and output are seconds.
export function calculateActiveDurationSeconds(
  accumulatedSeconds: number,
  activeStartedAtMs: number | null,
  nowMs: number,
): number {
  const base = Number.isFinite(accumulatedSeconds) && accumulatedSeconds >= 0 ? accumulatedSeconds : 0;
  if (activeStartedAtMs === null || !Number.isFinite(activeStartedAtMs) || !Number.isFinite(nowMs)) return base;
  const duration = base + Math.max(0, nowMs - activeStartedAtMs) / 1000;
  return Number.isFinite(duration) ? duration : base;
}
