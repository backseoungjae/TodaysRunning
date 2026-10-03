import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadActivityDetail } from '../services/activityService';

export function useActivityDetail(runId: string | undefined) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadActivityDetail>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    void revision;
    let active = true;
    setLoading(true); setData(null); setError(null);
    const request = runId ? loadActivityDetail(runId) : Promise.reject(new Error('러닝 기록을 선택해 주세요.'));
    void request.then((value) => { if (active) setData(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : '러닝 상세를 불러오지 못했어요.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [runId, revision]));
  return { data, error, loading, retry: () => setRevision((value) => value + 1) };
}
