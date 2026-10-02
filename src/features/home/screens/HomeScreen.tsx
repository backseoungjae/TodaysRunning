import { StyleSheet, Text, View } from 'react-native';

import { AppColors, AppSpacing } from '@/constants/theme';
import { AppScreen } from '@/shared/components/AppScreen';

export default function HomeScreen() {
  return (
    <AppScreen style={styles.screen}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          오늘의 러닝
        </Text>
        <Text style={styles.description}>가볍게 시작하는 나만의 러닝 습관</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  content: {
    gap: AppSpacing.medium,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  title: {
    color: AppColors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  description: {
    color: AppColors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
});
