import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { AppColors, AppSpacing } from '@/constants/theme';

type ScreenContainerProps = ScrollViewProps & {
  edges?: Edge[];
  footer?: ReactNode;
};

export function ScreenContainer({
  edges = ['top', 'right', 'bottom', 'left'],
  footer,
  style,
  contentContainerStyle,
  ...props
}: ScreenContainerProps) {
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <ScrollView
        {...props}
        style={[styles.scroll, style]}
        contentContainerStyle={[styles.content, contentContainerStyle]}
      />
      {footer != null && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: AppSpacing.large,
    gap: AppSpacing.medium,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  footer: {
    flexShrink: 0,
    padding: AppSpacing.large,
    gap: AppSpacing.medium,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
});
