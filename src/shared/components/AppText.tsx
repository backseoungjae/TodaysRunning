import { StyleSheet, Text, type TextProps } from 'react-native';

import { AppColors } from '@/constants/theme';

type AppTextProps = TextProps & {
  variant?: 'body' | 'title' | 'caption';
};

export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  return (
    <Text
      accessibilityRole={variant === 'title' ? 'header' : undefined}
      {...props}
      style={[styles.body, styles[variant], style]}
    />
  );
}

const styles = StyleSheet.create({
  body: {
    color: AppColors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 32,
    lineHeight: 42,
    fontWeight: '700',
  },
  caption: {
    color: AppColors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
});
