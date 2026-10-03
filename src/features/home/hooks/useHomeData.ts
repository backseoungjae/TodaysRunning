import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { loadHomeData } from '../services/homeService';

type HomeState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: Awaited<ReturnType<typeof loadHomeData>> };

export function useHomeData() {
  const [state, setState] = useState<HomeState>({ status: 'loading' });
  const requestId = useRef(0);
  const reload = useCallback(() => {
    const currentRequest = ++requestId.current;
    setState({ status: 'loading' });
    loadHomeData().then(
      (data) => {
        if (requestId.current === currentRequest) setState({ status: 'ready', data });
      },
      () => {
        if (requestId.current === currentRequest) setState({ status: 'error' });
      },
    );
  }, []);

  useFocusEffect(useCallback(() => {
    reload();
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') reload();
    });
    // Ignore pending reads after leaving Home or starting a newer request.
    return () => { requestId.current += 1; subscription.remove(); };
  }, [reload]));

  return { state, retry: reload };
}
