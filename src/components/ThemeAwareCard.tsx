import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface ThemeAwareCardProps extends ViewProps {
  variant?: 'surface' | 'hero';
}

export function ThemeAwareCard({ variant = 'surface', style, children, ...rest }: ThemeAwareCardProps) {
  const { colors, spacing, radius } = useTheme();
  const isHero = variant === 'hero';

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: isHero ? colors.heroSurface : colors.surface,
          borderRadius: radius.lg,
          padding: spacing.base,
          borderWidth: isHero ? 0 : 1,
          borderColor: colors.border,
        },
        styles.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
});
