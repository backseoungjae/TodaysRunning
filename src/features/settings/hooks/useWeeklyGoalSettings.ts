import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { WeeklyGoal } from '@/database/databaseTypes';
import { ensureCurrentWeeklyGoal, isCurrentGoalWeek, updateWeeklyTarget } from '@/features/training/services/weeklyGoalService';

export function useWeeklyGoalSettings() {
  const [goal, setGoal] = useState<WeeklyGoal | null>(null);
  const [target, setTarget] = useState(3);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const focused = useRef(false);
  const request = useRef(0);
  const locked = useRef(false);
  const weekKey = useRef<string | null>(null);
  const reload = useCallback(async () => {
    const token = ++request.current;
    setLoading(true); setError(null); setSaved(false);
    try {
      const value = await ensureCurrentWeeklyGoal();
      if (focused.current && token === request.current) { weekKey.current = value.weekStartDate; setGoal(value); setTarget(value.targetRuns); }
    } catch { if (focused.current && token === request.current) setError('주간 목표를 불러오지 못했어요. 다시 시도해 주세요.'); }
    finally { if (focused.current && token === request.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void reload();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !locked.current && !isCurrentGoalWeek(weekKey.current)) void reload();
    });
    return () => { focused.current = false; request.current += 1; subscription.remove(); };
  }, [reload]));

  async function save() {
    if (locked.current || loading || !goal) return;
    locked.current = true; setBusy(true); setError(null); setSaved(false);
    const token = ++request.current;
    try {
      const value = await updateWeeklyTarget(target);
      if (focused.current && token === request.current) { weekKey.current = value.weekStartDate; setGoal(value); setTarget(value.targetRuns); setSaved(true); }
    } catch { if (focused.current && token === request.current) setError('주간 목표를 저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { locked.current = false; setBusy(false); }
  }
  return { target, goal, loading, busy, error, saved, reload, save,
    dirty: !!goal && target !== goal.targetRuns,
    select: (value: number) => { if (!locked.current) { setTarget(value); setSaved(false); } } };
}
