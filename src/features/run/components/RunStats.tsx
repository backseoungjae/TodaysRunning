import { StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

import { useRunStore } from '../store/runStore';
import { calculatePaceSecondsPerKm } from '../utils/calculatePace';
import { formatDistance } from '../utils/formatDistance';
import { formatDuration } from '../utils/formatDuration';
import { formatPace } from '../utils/formatPace';

export function RunStats() {
  const distanceMeters = useRunStore((state) => state.distanceMeters);
  const elapsedSeconds = useRunStore((state) => state.elapsedSeconds);
  const averagePace = useRunStore((state) => calculatePaceSecondsPerKm(state.distanceMeters, state.elapsedSeconds));
  return (
    <View style={styles.stats}>
      <View style={styles.stat}>
        <AppText variant="caption">거리</AppText>
        <AppText style={styles.value} testID="run-distance">{formatDistance(distanceMeters)} km</AppText>
      </View>
      <View style={styles.stat}>
        <AppText variant="caption">운동 시간</AppText>
        <AppText style={styles.value} testID="run-duration">{formatDuration(elapsedSeconds)}</AppText>
      </View>
      <View style={styles.stat}>
        <AppText variant="caption">평균 페이스</AppText>
        <AppText style={styles.value} testID="run-average-pace">{formatPace(averagePace)} /km</AppText>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  stat: { flexGrow: 1, flexBasis: 110, gap: 4 },
  value: { fontSize: 24, lineHeight: 32, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
