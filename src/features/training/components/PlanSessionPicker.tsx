import { Pressable, StyleSheet, View } from 'react-native';

import { AppColors, AppSpacing } from '@/constants/theme';
import { AppText } from '@/shared/components/AppText';

import type { TrainingPlan, TrainingSession } from '../types/trainingTypes';
import { formatSessionGoal } from '../utils/planProgress';

type PlanSessionPickerProps = {
  plan: TrainingPlan;
  activeWeek: number;
  selectedSessionId?: string;
  recommendedSessionId?: string;
  completedSessionIds: ReadonlySet<string>;
  onSelectWeek: (week: number) => void;
  onSelectSession: (session: TrainingSession) => void;
};

export function PlanSessionPicker({
  plan, activeWeek, selectedSessionId, recommendedSessionId, completedSessionIds, onSelectWeek, onSelectSession,
}: PlanSessionPickerProps) {
  const weeks = [...new Set(plan.sessions.map((session) => session.week))];
  return (
    <View style={styles.container}>
      <View style={styles.weeks}>
        {weeks.map((week) => (
          <Pressable
            key={week}
            accessibilityRole="button"
            accessibilityLabel={`${week}주차`}
            accessibilityState={{ selected: activeWeek === week }}
            onPress={() => onSelectWeek(week)}
            style={[styles.week, activeWeek === week && styles.selected]}>
            <AppText style={styles.weekLabel}>{week}주차</AppText>
          </Pressable>
        ))}
      </View>
      {plan.sessions.filter((session) => session.week === activeWeek).map((session) => {
        const selected = selectedSessionId === session.id;
        const completed = completedSessionIds.has(session.id);
        const recommended = recommendedSessionId === session.id;
        return (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            accessibilityLabel={`${session.week}주차 ${session.day}회차 ${session.title}${completed ? ', 완료' : ''}${recommended ? ', 다음 러닝' : ''}`}
            accessibilityState={{ selected }}
            onPress={() => onSelectSession(session)}
            style={({ pressed }) => [styles.session, selected && styles.selected, pressed && styles.pressed]}>
            <AppText variant="caption">
              {completed ? '✓' : '○'} {session.day}회차 · {formatSessionGoal(session)}{completed ? ' · 완료' : ''}{recommended ? ' · 다음 러닝' : ''}{selected ? ' · 선택됨' : ''}
            </AppText>
            <AppText style={styles.sessionTitle}>{session.title}</AppText>
            <AppText variant="caption">{session.description}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  weeks: { flexDirection: 'row', gap: 8 },
  week: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center' },
  weekLabel: { textAlign: 'center', fontSize: 14 },
  session: { padding: AppSpacing.medium, gap: 4, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12 },
  selected: { borderColor: AppColors.text, backgroundColor: '#F3F4F6' },
  sessionTitle: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
