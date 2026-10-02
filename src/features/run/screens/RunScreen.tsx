import { router } from 'expo-router';

import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

export default function RunScreen() {
  return (
    <ScreenContainer
      edges={['top', 'right', 'left']}
      footer={
        <AppButton label="러닝 화면 열기" onPress={() => router.push('/running')} />
      }>
      <AppText variant="title">러닝 설정</AppText>
      <AppText>러닝 목표를 설정할 화면입니다.</AppText>
    </ScreenContainer>
  );
}
