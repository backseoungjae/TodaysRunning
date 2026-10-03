import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadActivity } from '../services/activityService';

export function useActivity() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadActivity>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    void revision;
    let active = true;
    setLoading(true); setData(null); setError(null);
    void loadActivity(weekOffset).then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setError('러닝 기록을 불러오지 못했어요. 다시 시도해 주세요.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [weekOffset, revision]));
  return { data, error, loading, weekOffset,
    previousWeek: () => setWeekOffset((offset) => offset - 1),
    nextWeek: () => setWeekOffset((offset) => Math.min(0, offset + 1)),
    retry: () => setRevision((value) => value + 1) };
}
