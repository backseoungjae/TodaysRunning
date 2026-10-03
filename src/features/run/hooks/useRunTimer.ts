import { useEffect } from 'react';

import { RUN_METRICS_CONFIG } from '@/constants/runMetricsConfig';

import { useRunStore } from '../store/runStore';

export function useRunTimer() {
  const activeStartedAtMs = useRunStore((state) => state.activeStartedAtMs);
  const refreshElapsedSeconds = useRunStore((state) => state.refreshElapsedSeconds);
  useEffect(() => {
    if (activeStartedAtMs === null) return;
    // The interval only refreshes the display; elapsed time comes from timestamps.
    refreshElapsedSeconds();
    const interval = setInterval(refreshElapsedSeconds, RUN_METRICS_CONFIG.TIMER_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeStartedAtMs, refreshElapsedSeconds]);
}
