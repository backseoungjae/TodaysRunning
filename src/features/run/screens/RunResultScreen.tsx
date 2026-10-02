import { router } from 'expo-router';

import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

export default function RunResultScreen() {
  return (
    <ScreenContainer
      footer={
        <AppButton label="활동 기록으로 이동" onPress={() => router.dismissTo('/(tabs)/activity')} />
      }>
      <AppText variant="title">러닝 결과</AppText>
      <AppText>완료한 러닝의 결과를 확인할 화면입니다.</AppText>
    </ScreenContainer>
  );
}
