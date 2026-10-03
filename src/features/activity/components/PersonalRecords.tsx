import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDistance } from '@/features/run/utils/formatDistance';
import { formatDuration } from '@/features/run/utils/formatDuration';
import { AppText } from '@/shared/components/AppText';

import type { calculatePersonalRecords } from '../utils/calculatePersonalRecords';

type Props = { records: ReturnType<typeof calculatePersonalRecords> };

export function PersonalRecords({ records }: Props) {
  const entries = [
    { label: '최장 거리', run: records.longestRun, value: records.longestRun ? `${formatDistance(records.longestRun.distanceMeters)} km` : '아직 기록이 없어요.' },
    { label: '최장 운동 시간', run: records.longestDuration, value: records.longestDuration ? formatDuration(records.longestDuration.activeDurationSeconds) : '아직 기록이 없어요.' },
    { label: 'Fastest 5K', run: records.fastest5K, value: records.fastest5K ? formatDuration(records.fastest5K.recordDurationSeconds) : '아직 5km 구간 기록이 없어요.' },
  ];
  return <View style={styles.container}>
    <AppText>개인 기록 · 전체 기간</AppText>
    {entries.map(({ label, run, value }, index) => <Pressable key={label} disabled={!run}
      accessibilityRole={run ? 'button' : 'text'} accessibilityLabel={`${label} · ${value}${run ? ' · 상세 보기' : ''}`}
      onPress={() => run && router.push({ pathname: '/activity/[runId]', params: { runId: run.id } })} style={styles.record}>
      <AppText variant="caption">{label}</AppText>
      <AppText testID={`personal-record-${index}`}>{value}</AppText>
    </Pressable>)}
    <AppText variant="caption">Fastest 5K는 5km 이상 완료한 러닝의 처음 5개 Split 시간이에요.</AppText>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 8, padding: 16, backgroundColor: '#F1F6ED', borderRadius: 12 },
  record: { minHeight: 48, justifyContent: 'center', gap: 4, paddingVertical: 4 },
});
