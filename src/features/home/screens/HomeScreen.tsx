import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppColors, AppSpacing } from '@/constants/theme';
import { getTrainingRunParams } from '@/features/run/utils/trainingSelection';
import { PlanSessionPicker } from '@/features/training/components/PlanSessionPicker';
import { beginnerPlan } from '@/features/training/data/beginnerPlan';
import { formatSessionGoal } from '@/features/training/utils/planProgress';
import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

import { useHomeData } from '../hooks/useHomeData';

export default function HomeScreen() {
  const { state, retry } = useHomeData();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  useFocusEffect(useCallback(() => {
    // Return from Result/Settings with the next incomplete session in view.
    setSelectedSessionId(null);
    setSelectedWeek(null);
  }, []));

  if (state.status !== 'ready') {
    return (
      <ScreenContainer edges={['top', 'right', 'left']}>
        <AppText variant="title">오늘의 러닝</AppText>
        <AppText>
          {state.status === 'loading' ? '오늘의 러닝을 준비하고 있어요.' : '러닝 정보를 불러오지 못했어요. 다시 시도해 주세요.'}
        </AppText>
        {state.status === 'error' && <AppButton label="다시 시도" onPress={retry} />}
      </ScreenContainer>
    );
  }

  const { planProgress, weeklyTarget, weeklyCompletedRuns } = state.data;
  const selectedSession = beginnerPlan.sessions.find((session) => session.id === selectedSessionId)
    ?? planProgress.nextSession;
  const activeWeek = selectedWeek ?? selectedSession?.week ?? 4;
  const remainingRuns = Math.max(0, weeklyTarget - weeklyCompletedRuns);

  function openRun() {
    router.navigate({
      pathname: '/(tabs)/run',
      params: selectedSession ? getTrainingRunParams(selectedSession) : {
        planId: undefined, sessionId: undefined, goalType: undefined,
        targetDurationSeconds: undefined, targetDistanceMeters: undefined,
      },
    });
  }

  return (
    <ScreenContainer
      edges={['top', 'right', 'left']}
      footer={<AppButton label="러닝 시작" onPress={openRun} />}>
      <AppText variant="title">오늘의 러닝</AppText>
      <AppText variant="caption">가볍게 시작하는 나만의 러닝 습관</AppText>

      <View style={styles.today}>
        {selectedSession ? (
          <>
            <AppText variant="caption">{selectedSession.week}주차 · {selectedSession.day}회차</AppText>
            <AppText style={styles.sessionTitle}>{selectedSession.title}</AppText>
            <AppText>오늘은 {formatSessionGoal(selectedSession)}, 내 속도로 시작해요.</AppText>
            <AppText variant="caption">{selectedSession.description}</AppText>
          </>
        ) : (
          <>
            <AppText style={styles.sessionTitle}>4주 플랜을 모두 마쳤어요!</AppText>
            <AppText>오늘은 자유롭게 달리거나, 아래에서 좋아하는 세션을 다시 골라보세요.</AppText>
          </>
        )}
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>이번 주 목표</AppText>
        <AppText testID="home-weekly-progress">{weeklyCompletedRuns} / {weeklyTarget}회 완료</AppText>
        <AppText variant="caption">
          {weeklyTarget === 0 ? '이번 주는 횟수에 부담 없이 움직여요.'
            : remainingRuns > 0 ? `이번 주 목표까지 ${remainingRuns}회 남았어요. 편안하게 이어가요.`
              : '이번 주 목표를 채웠어요. 나만의 리듬을 이어가요.'}
        </AppText>
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>{beginnerPlan.title}</AppText>
        <AppText variant="caption">{beginnerPlan.description}</AppText>
        <AppText testID="home-training-progress">{planProgress.completedCount} / {planProgress.totalCount}회 완료</AppText>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="4주 플랜 진행 상황"
          accessibilityValue={{ min: 0, max: planProgress.totalCount, now: planProgress.completedCount }}
          style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${planProgress.completedCount / planProgress.totalCount * 100}%` }]} />
        </View>
        <AppText variant="caption">러닝 사이에는 쉬는 날을 두고, 원하는 세션을 골라보세요.</AppText>
        <PlanSessionPicker
          plan={beginnerPlan}
          activeWeek={activeWeek}
          selectedSessionId={selectedSession?.id}
          completedSessionIds={planProgress.completedSessionIds}
          recommendedSessionId={planProgress.nextSession?.id}
          onSelectWeek={setSelectedWeek}
          onSelectSession={(session) => setSelectedSessionId(session.id)}
        />
      </View>
      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>최근 러닝</AppText>
        <AppText variant="caption">내 러닝 기록은 활동 탭에서 확인해 보세요.</AppText>
        <AppButton label="활동 기록 보기" onPress={() => router.navigate('/(tabs)/activity')} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  today: { padding: AppSpacing.large, borderRadius: 16, backgroundColor: '#F3F4F6', gap: 8 },
  sessionTitle: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  section: { gap: 12, marginTop: 8 },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  progressTrack: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: AppColors.text },
});
