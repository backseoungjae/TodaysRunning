import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

import { RunSessionMap } from '../components/RunSessionMap';
import { RunStats } from '../components/RunStats';
import { useRunCountdown } from '../hooks/useRunCountdown';
import { useRunLocation } from '../hooks/useRunLocation';
import { useRunTimer } from '../hooks/useRunTimer';
import { useRunNavigationGuard } from '../hooks/useRunNavigationGuard';
import { useRunStore } from '../store/runStore';
import { formatDistance } from '../utils/formatDistance';
import { readRunGoal } from '../utils/runGoalSelection';
import { readTrainingSelection, type TrainingRunParams } from '../utils/trainingSelection';

export default function RunningScreen() {
  const [viewMode, setViewMode] = useState<'stats' | 'map'>('stats');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalAcknowledged, setGoalAcknowledged] = useState(false);
  const actionLocked = useRef(false);
  const params = useLocalSearchParams<TrainingRunParams & { runId?: string }>();
  const { goalType, targetDurationSeconds, targetDistanceMeters, planId, sessionId } = params;
  const goal = useMemo(() => readRunGoal({goalType, targetDurationSeconds, targetDistanceMeters, planId, sessionId}), [goalType, targetDurationSeconds, targetDistanceMeters, planId, sessionId]);
  const selection = readTrainingSelection(params);
  const countdown = useRunCountdown(goal !== null && !params.runId);
  const tracking = useRunLocation({ runId: typeof params.runId === 'string' ? params.runId : undefined,
    session: selection.status === 'selected' ? selection.session : undefined,
    goal: goal ?? undefined, enabled: goal !== null && countdown.ready && !countdown.cancelled });
  useRunTimer();
  const status = useRunStore((state) => state.status);
  const distance = useRunStore((state) => state.distanceMeters);
  const elapsed = useRunStore((state) => state.elapsedSeconds);
  const pending = busy || tracking.status === 'starting' || tracking.status === 'stopping';
  useRunNavigationGuard(countdown.ready && goal !== null && (status !== 'completed' || tracking.status === 'starting'));

  const reached = goal?.goalType === 'time' ? elapsed >= goal.targetDurationSeconds!
    : goal?.goalType === 'distance' ? distance >= goal.targetDistanceMeters! : false;
  const goalMessage = reached && !goalAcknowledged && !!tracking.runId && status !== 'completed';

  async function act(action: 'pause' | 'resume' | 'finish' | 'goalFinish') {
    if (actionLocked.current) return;
    actionLocked.current = true; setBusy(true); setError(null);
    try {
      if (action === 'pause') await tracking.stop();
      else if (action === 'resume') await tracking.start();
      else {
        if (action === 'goalFinish' && !await tracking.stop()) return;
        if (await tracking.finish()) {
          setGoalAcknowledged(true);
          router.replace({ pathname: '/runResult', params: { runId: tracking.runId! } });
        }
      }
    } catch { setError('러닝 상태를 저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { actionLocked.current = false; setBusy(false); }
  }

  if (!countdown.ready || countdown.cancelled || !goal) return (
    <ScreenContainer footer={<AppButton label="취소 · 러닝 설정으로" onPress={() => router.dismissTo('/(tabs)/run')} />}>
      <AppText variant="title">{!goal ? '목표를 확인해 주세요' : countdown.cancelled ? '시작을 취소했어요' : '러닝 준비'}</AppText>
      {!countdown.cancelled && goal && <AppText accessibilityLiveRegion="assertive" style={styles.countdown}>{countdown.label}</AppText>}
      <AppText>{!goal ? '러닝 설정에서 목표를 다시 선택해 주세요.' : countdown.cancelled ? '앱을 사용하는 동안 다시 시작해 주세요.' : '잠시 후 위치 기록과 타이머를 시작합니다.'}</AppText>
    </ScreenContainer>
  );

  return (
    <ScreenContainer footer={goalMessage ? <>
      <AppButton label="계속 달리기" disabled={pending} onPress={() => {
        setGoalAcknowledged(true);
        if (status === 'paused') void act('resume');
      }} />
      <AppButton label="러닝 종료" disabled={pending} onPress={() => { void act('goalFinish'); }} />
    </> : <>
      {status === 'running' ? <AppButton label="일시정지" disabled={pending} onPress={() => { void act('pause'); }} /> :
        <AppButton label={status === 'paused' ? '계속 달리기' : '다시 시작'} disabled={pending} onPress={() => { void act('resume'); }} />}
      {status === 'paused' && <AppButton label="러닝 종료" disabled={pending} onPress={() => { void act('finish'); }} />}
    </>}>
      <AppText variant="title">러닝</AppText>
      <RunSessionSummary />
      {goalMessage && <View style={styles.goal} accessibilityRole="alert">
        <AppText variant="title">목표 달성!</AppText>
        <AppText>계속 달리거나 러닝을 종료할 수 있어요.</AppText>
      </View>}
      <View style={styles.viewToggle}>
        <AppButton label="Stats" accessibilityLabel="통계 보기" accessibilityState={{ selected: viewMode === 'stats' }} style={styles.viewButton} onPress={() => setViewMode('stats')} />
        <AppButton label="Map" accessibilityLabel="지도 보기" accessibilityState={{ selected: viewMode === 'map' }} style={styles.viewButton} onPress={() => setViewMode('map')} />
      </View>
      {viewMode === 'stats' ? <RunStats /> : <RunSessionMap />}
      <AppText>{tracking.status === 'starting' ? '위치 추적을 준비하고 있어요.' : tracking.status === 'stopping' ? '위치 기록을 저장하고 있어요.' : tracking.status === 'tracking' ? tracking.validLocation ? '위치를 기록하고 있어요.' : 'GPS 신호를 찾고 있어요.' : '러닝을 일시정지했어요.'}</AppText>
      {tracking.rejectionReason === 'poor_accuracy' && <AppText>위치 정확도가 낮아요. 하늘이 잘 보이는 곳에서 잠시 기다려 주세요.</AppText>}
      <AppText variant="caption">{tracking.backgroundEnabled ? '화면이 꺼져도 가능한 동안 위치를 기록해요.' : '앱을 사용하는 동안 위치를 기록해요. 다른 앱으로 이동하면 일시정지합니다.'}</AppText>
      {tracking.backgroundNotice && <AppText variant="caption">{tracking.backgroundNotice}</AppText>}
      {(error || tracking.error) && <AppText accessibilityRole="alert">{error ?? tracking.error}</AppText>}
    </ScreenContainer>
  );
}

function RunSessionSummary() {
  const status = useRunStore((state) => state.status);
  const goalType = useRunStore((state) => state.goalType);
  const targetDistanceMeters = useRunStore((state) => state.targetDistanceMeters);
  const targetDurationSeconds = useRunStore((state) => state.targetDurationSeconds);
  return <>
    <AppText>{{ idle: '준비', running: '러닝 중', paused: '일시정지', completed: '종료' }[status]}</AppText>
    {goalType === 'distance' && <AppText>목표: {formatDistance(targetDistanceMeters ?? 0)} km</AppText>}
    {goalType === 'time' && <AppText>목표: {(targetDurationSeconds ?? 0) / 60}분</AppText>}
  </>;
}
const styles = StyleSheet.create({ viewToggle: { flexDirection: 'row', gap: 12 }, viewButton: { flex: 1 }, countdown: { fontSize: 96, lineHeight: 120, textAlign: 'center', paddingVertical: 80 }, goal: { gap: 12, padding: 16, backgroundColor: '#E7F3FF', borderRadius: 12 } });
