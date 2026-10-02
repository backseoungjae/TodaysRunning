import { PlatformPressable } from 'expo-router/react-navigation';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/constants/theme';

type TabButtonProps = ComponentProps<typeof PlatformPressable> & {
  label: string;
  icon: ComponentProps<typeof SymbolView>['name'];
};

export function TabButton({ label, icon, style, ...props }: TabButtonProps) {
  const color = props['aria-selected'] === true ? AppColors.text : AppColors.textSecondary;

  return (
    <PlatformPressable {...props} style={[style, styles.button]}>
      <View pointerEvents="none" aria-hidden style={styles.content}>
        <View style={styles.icon}>
          <SymbolView
            name={icon}
            size={24}
            tintColor={color}
            style={styles.symbol}
            accessible={false}
          />
        </View>
        <Text accessible={false} style={[styles.label, { color }]}>
          {label}
        </Text>
      </View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    minHeight: 52,
  },
  content: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  icon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    width: '100%',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
