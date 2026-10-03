import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, AppSpacing } from '@/constants/theme';
import { formatDistance } from '@/features/run/utils/formatDistance';
import { formatDuration } from '@/features/run/utils/formatDuration';
import { formatPace } from '@/features/run/utils/formatPace';
import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';

import { ActivityCard } from '../components/ActivityCard';
import { PersonalRecords } from '../components/PersonalRecords';
import { useActivity } from '../hooks/useActivity';
import { formatWeekRange } from '../utils/formatRunDate';

export default function ActivityScreen() {
  const activity = useActivity();
  const statistics = activity.data?.statistics;
  const empty = !activity.loading && !activity.error && activity.data?.runs.length === 0;
  return <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
    <FlatList data={activity.data?.runs ?? []} keyExtractor={(run) => run.id}
      renderItem={({ item }) => <ActivityCard run={item} />}
      contentContainerStyle={styles.content} ItemSeparatorComponent={Separator}
      ListHeaderComponent={<View style={styles.header}>
        <AppText variant="title">활동 기록</AppText>
        <AppText>{activity.weekOffset === 0 ? '이번 주 러닝' : '주간 러닝'}</AppText>
        <View style={styles.weekNavigation}>
          <AppButton label="이전 주" disabled={activity.loading} onPress={activity.previousWeek} style={styles.weekButton} />
          <AppButton label="다음 주" disabled={activity.loading || activity.weekOffset === 0} onPress={activity.nextWeek} style={styles.weekButton} />
        </View>
        {activity.loading && <AppText>러닝 기록을 불러오고 있어요.</AppText>}
        {activity.error && <><AppText accessibilityRole="alert">{activity.error}</AppText><AppButton label="다시 불러오기" onPress={activity.retry} /></>}
        {statistics && activity.data && <View style={styles.statistics}>
          <AppText variant="caption">{formatWeekRange(activity.data.week.startSeconds, activity.data.week.endSeconds)}</AppText>
          <AppText testID="weekly-run-count">러닝 횟수 · {statistics.runCount}회</AppText>
          <AppText testID="weekly-distance">총 거리 · {formatDistance(statistics.distanceMeters)} km</AppText>
          <AppText testID="weekly-duration">총 운동 시간 · {formatDuration(statistics.activeDurationSeconds)}</AppText>
          <AppText testID="weekly-pace">평균 Pace · {formatPace(statistics.averagePaceSeconds)} /km</AppText>
          {statistics.runCount === 0 && <AppText variant="caption">이 주에는 완료한 러닝이 없어요.</AppText>}
        </View>}
        {activity.data && <PersonalRecords records={activity.data.personalRecords} />}
        {!!activity.data?.runs.length && <AppText>러닝 기록 · 최신순</AppText>}
      </View>}
      ListEmptyComponent={empty ? <View style={styles.empty}>
        <AppText>아직 러닝 기록이 없어요.</AppText>
        <AppText>첫 러닝을 시작하면{ '\n' }여기에 기록이 쌓여요.</AppText>
      </View> : null}
    />
    {empty && <View style={styles.footer}><AppButton label="첫 러닝 시작" onPress={() => router.navigate('/(tabs)/run')} /></View>}
  </SafeAreaView>;
}
function Separator() { return <View style={styles.separator} />; }
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.background },
  content: { flexGrow: 1, padding: AppSpacing.large, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { gap: AppSpacing.medium, paddingBottom: AppSpacing.medium },
  statistics: { gap: 8, padding: 16, backgroundColor: '#E7F3FF', borderRadius: 12 },
  weekNavigation: { flexDirection: 'row', gap: 12 }, weekButton: { flex: 1 },
  empty: { gap: 12, paddingVertical: 24 }, separator: { height: AppSpacing.medium },
  footer: { padding: AppSpacing.large, width: '100%', maxWidth: 600, alignSelf: 'center' },
});
