import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import type { Run } from '@/database/databaseTypes';
import { calculatePaceSecondsPerKm } from '@/features/run/utils/calculatePace';
import { formatDistance } from '@/features/run/utils/formatDistance';
import { formatDuration } from '@/features/run/utils/formatDuration';
import { formatPace } from '@/features/run/utils/formatPace';
import { AppText } from '@/shared/components/AppText';

import { formatRunDate } from '../utils/formatRunDate';

export const ActivityCard = memo(function ActivityCard({ run }: { run: Run }) {
  const date = formatRunDate(run.startedAt);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${date} 러닝 상세 보기`}
    testID={`activity-${run.id}`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    onPress={() => router.push({ pathname: '/activity/[runId]', params: { runId: run.id } })}>
    <AppText variant="caption">{date}</AppText>
    <AppText style={styles.distance}>{formatDistance(run.distanceMeters)} km</AppText>
    <AppText>운동 시간 · {formatDuration(run.activeDurationSeconds)}</AppText>
    <AppText>평균 Pace · {formatPace(calculatePaceSecondsPerKm(run.distanceMeters, run.activeDurationSeconds))} /km</AppText>
  </Pressable>;
});
const styles = StyleSheet.create({ card: { padding: 16, gap: 8, borderRadius: 12, backgroundColor: '#F2F5F8' }, pressed: { opacity: 0.7 }, distance: { fontSize: 24, lineHeight: 32, fontWeight: '600' } });
