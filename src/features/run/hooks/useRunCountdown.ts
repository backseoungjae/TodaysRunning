import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

export function useRunCountdown(enabled: boolean) {
  const [label, setLabel] = useState<string | null>(enabled ? '3' : null);
  const [ready, setReady] = useState(!enabled);
  const [cancelled, setCancelled] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    const startedAt = Date.now();
    setReady(false); setCancelled(false); setLabel('3');
    const interval = setInterval(() => {
      const seconds = Math.floor(Math.max(0, Date.now() - startedAt) / 1000);
      if (seconds >= 4) { clearInterval(interval); subscription.remove(); setLabel(null); setReady(true); }
      else setLabel(seconds >= 3 ? 'GO' : String(3 - seconds));
    }, 100);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { clearInterval(interval); setCancelled(true); setReady(false); }
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [enabled]));
  return { label, ready, cancelled };
}
