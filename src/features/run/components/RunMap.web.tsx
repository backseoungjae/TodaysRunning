import { StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';

import type { RunMapProps } from '../types/runMapTypes';

export function RunMap({ coordinates, fitRoute = false }: RunMapProps) {
  return (
    <View style={styles.container}>
      <AppText>러닝 지도는 iOS·Android 앱에서 사용할 수 있어요.</AppText>
      <AppText variant="caption">{fitRoute ? '저장한 경로 지점' : '위치 기록은 계속됩니다. 기록한 경로 지점'}: {coordinates.length}개</AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { minHeight: 240, justifyContent: 'center', gap: 12 },
});
