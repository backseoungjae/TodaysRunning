import { Alert, Platform } from 'react-native';

export const backgroundPermissionExplanation = '화면을 끄거나 다른 앱을 사용하는 동안에도 경로를 기록하려면 추가 위치 권한이 필요해요. 권한 설정 중 시스템 설정 화면이 열릴 수 있어요. 추가 권한이 없어도 앱을 사용하는 동안 러닝할 수 있어요.';

export function confirmLocationPermission(): Promise<boolean> {
  const title = '위치 권한이 필요합니다';
  const message = '러닝 거리와 이동 경로를 기록하기 위해\n위치 권한이 필요합니다.';
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      { text: '권한 설정', onPress: () => resolve(true) },
    ], { cancelable: false });
  });
}

export function confirmOpenAppSettings(): Promise<boolean> {
  const message = '위치 권한을 변경하려면\n시스템 설정에서 변경해주세요.';
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(`${message}\n브라우저의 사이트 설정에서 변경해 주세요.`));
  return new Promise((resolve) => {
    Alert.alert('위치 권한 변경', message, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      { text: '설정 열기', onPress: () => resolve(true) },
    ], { cancelable: false });
  });
}
