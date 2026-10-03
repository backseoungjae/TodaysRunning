import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatSessionGoal } from '@/features/training/utils/planProgress';
import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { backgroundPermissionExplanation } from '@/shared/services/locationPermissionAlerts';

import { useRunPermissionStart } from '../hooks/useRunPermissionStart';
import { DISTANCE_PRESETS_KM, FREE_RUN_GOAL, TIME_PRESETS_MINUTES, type RunGoal } from '../types/runGoalTypes';
import { getRunGoalParams } from '../utils/runGoalSelection';
import { readTrainingSelection, type TrainingRunParams } from '../utils/trainingSelection';

export default function RunScreen() {
  const params = useLocalSearchParams<TrainingRunParams>();
  const selection = readTrainingSelection(params);
  const [goal, setGoal] = useState<RunGoal>(FREE_RUN_GOAL);
  const { start, busy, error } = useRunPermissionStart(selection.status === 'selected' ? params : getRunGoalParams(goal));

  return (
    <ScreenContainer edges={['top', 'right', 'left']} footer={
      <AppButton label={busy ? 'GPS 확인 중…' : 'START'} disabled={selection.status === 'invalid' || busy} onPress={start} />
    }>
      <AppText variant="title">러닝 설정</AppText>
      {selection.status === 'selected' ? <>
        <AppText variant="caption">Beginner Plan · {selection.session.week}주차 {selection.session.day}회차</AppText>
        <AppText>{selection.session.title}</AppText>
        <AppText>목표: {formatSessionGoal(selection.session)}</AppText>
        <AppText variant="caption">{selection.session.description}</AppText>
        <AppButton label="자유 러닝으로 변경" disabled={busy} onPress={() => router.replace('/(tabs)/run')} />
      </> : selection.status === 'invalid' ? <>
        <AppText>선택한 플랜 정보를 확인할 수 없어요. 홈에서 세션을 다시 선택해 주세요.</AppText>
        <AppButton label="홈으로 이동" onPress={() => router.navigate('/(tabs)')} />
        <AppButton label="자유 러닝으로 변경" onPress={() => router.replace('/(tabs)/run')} />
      </> : <>
        <AppText>오늘은 어떻게 달릴까요?</AppText>
        <View style={styles.options}>
          {(['none', 'time', 'distance'] as const).map((type, index) => <AppButton key={type}
            label={['자유 러닝', '시간 러닝', '거리 러닝'][index]} disabled={busy}
            accessibilityState={{ selected: goal.goalType === type }}
            style={goal.goalType === type ? styles.selected : styles.option}
            onPress={() => setGoal({ goalType: type, targetDurationSeconds: type === 'time' ? 1200 : null, targetDistanceMeters: type === 'distance' ? 3000 : null })} />)}
        </View>
        {goal.goalType === 'time' && <View style={styles.options}>
          {TIME_PRESETS_MINUTES.map((minutes) => <AppButton key={minutes} label={`${minutes}분`} disabled={busy}
            style={goal.targetDurationSeconds === minutes * 60 ? styles.selected : styles.option}
            accessibilityState={{ selected: goal.targetDurationSeconds === minutes * 60 }}
            onPress={() => setGoal({ ...goal, targetDurationSeconds: minutes * 60 })} />)}
        </View>}
        {goal.goalType === 'distance' && <View style={styles.options}>
          {DISTANCE_PRESETS_KM.map((km) => <AppButton key={km} label={`${km}km`} disabled={busy}
            style={goal.targetDistanceMeters === km * 1000 ? styles.selected : styles.option}
            accessibilityState={{ selected: goal.targetDistanceMeters === km * 1000 }}
            onPress={() => setGoal({ ...goal, targetDistanceMeters: km * 1000 })} />)}
        </View>}
        <AppText>{goal.goalType === 'none' ? '목표 없이 편안하게 달려보세요.' : '목표를 달성해도 계속 달릴 수 있어요.'}</AppText>
      </>}
      <AppText variant="caption">현재 위치를 확인한 뒤 3 · 2 · 1 · GO 카운트다운으로 시작해요.</AppText>
      <AppText variant="caption">{backgroundPermissionExplanation}</AppText>
      {error && <AppText accessibilityRole="alert">{error}</AppText>}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({ options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { backgroundColor: '#657080' }, selected: { backgroundColor: '#208AEF' } });
