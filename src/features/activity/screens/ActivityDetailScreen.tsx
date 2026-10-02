import { router, useLocalSearchParams } from 'expo-router';

import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

export default function ActivityDetailScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();

  return (
    <ScreenContainer
      footer={
        <AppButton label="활동 기록으로 돌아가기" onPress={() => router.dismissTo('/(tabs)/activity')} />
      }>
      <AppText variant="title">활동 상세</AppText>
      <AppText>선택한 러닝의 상세 기록을 표시할 화면입니다.</AppText>
      <AppText variant="caption">기록 ID: {runId}</AppText>
    </ScreenContainer>
  );
}
