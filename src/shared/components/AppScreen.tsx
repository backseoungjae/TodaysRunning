import { StyleSheet, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors, AppSpacing } from '@/constants/theme';

export function AppScreen({ style, ...props }: ViewProps) {
  return <SafeAreaView {...props} style={[styles.container, style]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
    padding: AppSpacing.large,
  },
});
