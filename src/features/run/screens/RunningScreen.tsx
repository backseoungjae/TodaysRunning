import { router } from 'expo-router';

import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

export default function RunningScreen() {
  return (
    <ScreenContainer
      footer={
        <>
          <AppButton label="결과 화면 열기" onPress={() => router.replace('/runResult')} />
          <AppButton label="러닝 설정으로 돌아가기" onPress={() => router.dismissTo('/(tabs)/run')} />
        </>
      }>
      <AppText variant="title">러닝</AppText>
      <AppText>러닝 중 거리와 시간을 표시할 화면입니다.</AppText>
    </ScreenContainer>
  );
}
