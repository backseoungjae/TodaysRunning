import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

export default function SettingsScreen() {
  return (
    <ScreenContainer edges={['top', 'right', 'left']}>
      <AppText variant="title">설정</AppText>
      <AppText>앱 설정을 관리할 화면입니다.</AppText>
    </ScreenContainer>
  );
}
