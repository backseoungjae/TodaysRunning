import { router } from 'expo-router';

import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

export default function ActivityScreen() {
  return (
    <ScreenContainer
      edges={['top', 'right', 'left']}
      footer={
        <AppButton
          label="예시 기록 상세 보기"
          onPress={() => router.push({ pathname: '/activity/[runId]', params: { runId: 'example-run' } })}
        />
      }>
      <AppText variant="title">활동 기록</AppText>
      <AppText>러닝 기록 목록을 표시할 화면입니다.</AppText>
    </ScreenContainer>
  );
}
