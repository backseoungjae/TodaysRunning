import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, BackHandler, Platform } from 'react-native';

export function useRunNavigationGuard(enabled: boolean) {
  useFocusEffect(useCallback(() => {
    if (!enabled || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('진행 중인 러닝', '일시정지한 뒤 러닝 종료 버튼을 눌러 기록을 저장해 주세요.');
      return true;
    });
    return () => subscription.remove();
  }, [enabled]));
}
