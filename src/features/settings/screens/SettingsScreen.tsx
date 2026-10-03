import { StyleSheet, Switch, View } from 'react-native';

import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { backgroundPermissionExplanation } from '@/shared/services/locationPermissionAlerts';
import type { LocationPermissionStatus } from '@/shared/types/locationPermissionTypes';

import { useSettingsLocationPermission } from '../hooks/useSettingsLocationPermission';
import { useWeeklyGoalSettings } from '../hooks/useWeeklyGoalSettings';
import { MAX_WEEKLY_TARGET } from '@/features/training/services/weeklyGoalService';

const permissionDescriptions: Record<LocationPermissionStatus, string> = {
  none: '권한 없음',
  denied: '권한 없음',
  blocked: '권한 없음 · 시스템 설정에서 변경해 주세요.',
  foreground: '앱 사용 중 허용',
  background: '항상 허용',
};

export default function SettingsScreen() {
  const { permission, loading, error, refresh, toggle, busy, actionError, openSettings } = useSettingsLocationPermission();
  const enabled = permission?.foreground.granted === true;
  const weekly = useWeeklyGoalSettings();

  return (
    <ScreenContainer
      edges={['top', 'right', 'left']}
      footer={<>
        <AppButton label={weekly.busy ? '주간 목표 저장 중…' : '주간 목표 저장'} disabled={weekly.loading || weekly.busy || !weekly.dirty}
          onPress={() => { void weekly.save(); }} />
        <AppButton label="시스템 설정 열기" disabled={busy} onPress={openSettings} />
      </>}>
      <AppText variant="title">설정</AppText>
      <View style={styles.section}>
        <AppText style={styles.title}>주간 러닝 목표</AppText>
        {weekly.loading ? <AppText>주간 목표를 불러오고 있어요.</AppText> : weekly.goal && <View style={styles.row}>
          <AppButton label="−" accessibilityLabel="주간 목표 줄이기" disabled={weekly.busy || weekly.target <= 0} onPress={() => weekly.select(weekly.target - 1)} />
          <AppText testID="settings-weekly-target" style={styles.title}>주 {weekly.target}회</AppText>
          <AppButton label="+" accessibilityLabel="주간 목표 늘리기" disabled={weekly.busy || weekly.target >= MAX_WEEKLY_TARGET} onPress={() => weekly.select(weekly.target + 1)} />
        </View>}
        <AppText variant="caption">0~{MAX_WEEKLY_TARGET}회 중 편안한 횟수를 선택하세요. 저장하면 이번 주 목표와 앞으로 새 주에 사용할 기본 목표에 적용됩니다.</AppText>
        <AppText variant="caption">지난 주의 목표는 유지됩니다. 0회로 설정하면 횟수 목표 없이 달릴 수 있어요.</AppText>
        {weekly.saved && <AppText accessibilityLiveRegion="polite">주간 목표를 저장했어요.</AppText>}
        {weekly.error && <AppText accessibilityRole="alert">{weekly.error}</AppText>}
        {weekly.error && !weekly.goal && <AppButton label="주간 목표 다시 불러오기" onPress={() => { void weekly.reload(); }} />}
      </View>
      <View style={styles.section}>
        <View style={styles.row}>
          <AppText style={styles.title}>위치 권한</AppText>
          <AppText>{loading || !permission ? '확인 중' : enabled ? 'ON' : 'OFF'}</AppText>
          <Switch
            accessibilityLabel="위치 권한"
            value={enabled}
            disabled={loading || !permission || busy}
            onValueChange={toggle}
          />
        </View>
        <AppText>{permission ? permissionDescriptions[permission.status] : '위치 권한을 확인하고 있어요.'}</AppText>
        <AppText variant="caption">{backgroundPermissionExplanation}</AppText>
        {permission?.backgroundStatusUnavailable && enabled && (
          <AppText variant="caption">추가 권한을 확인하지 못했어요. 앱을 사용하는 동안 러닝할 수 있어요.</AppText>
        )}
        {busy && <AppText variant="caption">권한 설정을 확인하고 있어요.</AppText>}
        {(error || actionError) && <AppText accessibilityRole="alert">{error || actionError}</AppText>}
        {error && <AppButton label="다시 확인" onPress={() => { void refresh(); }} />}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontWeight: '600' },
});
