import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getLocationPermissionStatus, requestLocationPermissionFlow } from '../services/locationService';
import type { LocationPermissionSnapshot } from '../types/locationPermissionTypes';

export function useLocationPermission() {
  const [permission, setPermission] = useState<LocationPermissionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(false);
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const currentRevision = ++revision.current;
    try {
      const result = await getLocationPermissionStatus();
      if (mounted.current && currentRevision === revision.current) {
        setPermission(result);
        setError(null);
      }
    } catch {
      if (mounted.current && currentRevision === revision.current) {
        setPermission(null);
        setError('위치 권한 상태를 확인하지 못했어요. 다시 시도해 주세요.');
      }
    } finally {
      if (mounted.current && currentRevision === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      mounted.current = false;
      revision.current += 1;
      subscription.remove();
    };
  }, [refresh]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const request = useCallback(async () => {
    // Re-read after the entire flow: an AppState refresh may finish during a system dialog.
    try {
      return await requestLocationPermissionFlow();
    } finally {
      await refresh();
    }
  }, [refresh]);

  return { permission, loading, error, refresh, request };
}
