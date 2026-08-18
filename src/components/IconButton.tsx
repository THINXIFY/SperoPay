import React from 'react';
import { Pressable, StyleSheet, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress: (event: GestureResponderEvent) => void;
  variant?: 'default' | 'strong';
  size?: number;
  accessibilityLabel: string;
}

export function IconButton({ name, onPress, variant = 'default', size = 20, accessibilityLabel }: IconButtonProps) {
  const { colors, radius } = useTheme();
  const isStrong = variant === 'strong';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isStrong ? colors.heroSurface : colors.surface,
          borderRadius: radius.full,
          borderWidth: isStrong ? 0 : 1,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={name} size={size} color={isStrong ? colors.heroSurfaceText : colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
