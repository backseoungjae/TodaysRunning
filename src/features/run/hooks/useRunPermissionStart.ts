import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import type { TrainingRunParams } from '../utils/trainingSelection';

import { prepareRunLocationPermission } from '../services/runPermissionService';
import { getCurrentRunLocation } from '@/shared/services/locationService';
import { filterGpsLocation } from '../services/gpsFilterService';

export function useRunPermissionStart(params?: TrainingRunParams) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    setBusy(locked.current);
    return () => { focused.current = false; };
  }, []));

  async function start() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const permission = await prepareRunLocationPermission();
      if (!focused.current) return;
      if (!permission) { router.navigate('/(tabs)'); return; }
      const raw = await getCurrentRunLocation();
      if (!filterGpsLocation(raw, null).accepted) throw new Error('GPS 위치가 정확하지 않아요. 하늘이 잘 보이는 곳에서 다시 시도해 주세요.');
      if (focused.current) router.push(params ? { pathname: '/running', params } : '/running');
    } catch (reason) {
      if (focused.current) setError(reason instanceof Error ? reason.message : '위치를 확인하지 못했어요. 다시 시도해 주세요.');
    } finally {
      locked.current = false;
      if (focused.current) setBusy(false);
    }
  }
  return { start, busy, error };
}
