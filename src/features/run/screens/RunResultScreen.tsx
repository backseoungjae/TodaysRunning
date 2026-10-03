import { router, useLocalSearchParams } from 'expo-router';

import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

import { RunMap } from '../components/RunMap';
import { useRunResult } from '../hooks/useRunResult';
import { calculatePaceSecondsPerKm } from '../utils/calculatePace';
import { formatDistance } from '../utils/formatDistance';
import { formatDuration } from '../utils/formatDuration';
import { formatPace } from '../utils/formatPace';

export default function RunResultScreen() {
  const { runId } = useLocalSearchParams<{ runId?: string | string[] }>();
  const result = useRunResult(typeof runId === 'string' ? runId : undefined);
  const run = result.data?.run;
  return <ScreenContainer footer={<AppButton label="홈으로 이동" onPress={() => router.dismissTo('/(tabs)')} />}>
    <AppText variant="title">러닝 결과</AppText>
    {result.loading && <AppText>러닝 기록을 불러오고 있어요.</AppText>}
    {result.error && <><AppText accessibilityRole="alert">{result.error}</AppText><AppButton label="다시 불러오기" onPress={result.retry} /></>}
    {run && result.data && <>
      <AppText>수고했어요! 러닝 기록을 저장했습니다.</AppText>
      <AppText testID="result-distance">거리 · {formatDistance(run.distanceMeters)} km</AppText>
      <AppText testID="result-duration">운동 시간 · {formatDuration(run.activeDurationSeconds)}</AppText>
      <AppText testID="result-pace">평균 Pace · {formatPace(calculatePaceSecondsPerKm(run.distanceMeters, run.activeDurationSeconds))} /km</AppText>
      <AppText>러닝 경로</AppText>
      {result.data.coordinates.length ? <RunMap coordinates={result.data.coordinates} showCurrentLocation={false} followCurrentLocation={false} fitRoute /> : <AppText>저장한 GPS 경로가 없어요.</AppText>}
      <AppText>이번 주 진행률</AppText>
      <AppText testID="result-weekly-progress">{result.data.weeklyCompletedRuns} / {result.data.weeklyTarget}회 완료</AppText>
      <AppText variant="caption">{result.data.weeklyTarget === 0 ? '횟수에 부담 없이 나만의 리듬으로 달려요.' : result.data.weeklyCompletedRuns >= result.data.weeklyTarget ? '이번 주 러닝 목표를 달성했어요!' : '다음 러닝도 편안하게 이어가세요.'}</AppText>
    </>}
  </ScreenContainer>;
}
