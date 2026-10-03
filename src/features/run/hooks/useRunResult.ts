import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadRunResult } from '../services/runResultService';

export function useRunResult(runId: string | undefined) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadRunResult>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    void revision;
    let active = true;
    setLoading(true); setError(null); setData(null);
    const request = runId ? loadRunResult(runId) : Promise.reject(new Error('러닝 기록을 선택해 주세요.'));
    void request.then((value) => { if (active) setData(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : '러닝 결과를 불러오지 못했어요.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [runId, revision]));
  return { data, error, loading, retry: () => setRevision((value) => value + 1) };
}
