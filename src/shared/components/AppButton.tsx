import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { AppColors, AppSpacing } from '@/constants/theme';
import { AppText } from '@/shared/components/AppText';

type AppButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
};

export function AppButton({
  label,
  disabled = false,
  accessibilityState,
  style,
  ...props
}: AppButtonProps) {
  const isDisabled = disabled === true;

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
      disabled={isDisabled}
      style={(state) => [
        styles.button,
        (state.pressed || isDisabled) && styles.dimmed,
        typeof style === 'function' ? style(state) : style,
      ]}>
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.text,
    padding: AppSpacing.medium,
    borderRadius: 12,
  },
  dimmed: {
    opacity: 0.6,
  },
  label: {
    color: AppColors.background,
    fontWeight: '600',
    textAlign: 'center',
  },
});
