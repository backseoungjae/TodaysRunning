import { router, useLocalSearchParams } from 'expo-router';

import { RunMap } from '@/features/run/components/RunMap';
import { formatDistance } from '@/features/run/utils/formatDistance';
import { formatDuration } from '@/features/run/utils/formatDuration';
import { formatPace } from '@/features/run/utils/formatPace';
import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

import { useActivityDetail } from '../hooks/useActivityDetail';
import { formatRunDate } from '../utils/formatRunDate';

export default function ActivityDetailScreen() {
  const { runId } = useLocalSearchParams<{ runId?: string | string[] }>();
  const detail = useActivityDetail(typeof runId === 'string' ? runId : undefined);
  const run = detail.data?.run;
  return <ScreenContainer footer={<AppButton label="활동 기록으로 돌아가기" onPress={() => router.dismissTo('/(tabs)/activity')} />}>
    <AppText variant="title">활동 상세</AppText>
    {detail.loading && <AppText>러닝 상세를 불러오고 있어요.</AppText>}
    {detail.error && <><AppText accessibilityRole="alert">{detail.error}</AppText><AppButton label="다시 불러오기" onPress={detail.retry} /></>}
    {run && detail.data && <>
      <AppText>{formatRunDate(run.startedAt)}</AppText>
      <AppText testID="activity-detail-distance">거리 · {formatDistance(run.distanceMeters)} km</AppText>
      <AppText testID="activity-detail-duration">운동 시간 · {formatDuration(run.activeDurationSeconds)}</AppText>
      <AppText testID="activity-detail-pace">평균 Pace · {formatPace(detail.data.averagePaceSeconds)} /km</AppText>
      <AppText>1km Split</AppText>
      <AppText variant="caption">완료한 1km 구간만 표시하며, 마지막 1km 미만 구간은 제외해요.</AppText>
      {detail.data.splits.length ? detail.data.splits.map((split) => <AppText key={split.id} testID={`split-${split.splitNumber}`}>
        {split.splitNumber} km · {formatPace(split.paceSecondsPerKm)} /km
      </AppText>) : <AppText>저장된 1km 구간 기록이 없어요.</AppText>}
      <AppText>전체 러닝 경로</AppText>
      {detail.data.coordinates.length ? <RunMap key={run.id} coordinates={detail.data.coordinates}
        showCurrentLocation={false} followCurrentLocation={false} fitRoute /> : <AppText>저장한 GPS 경로가 없어요.</AppText>}
    </>}
  </ScreenContainer>;
}
