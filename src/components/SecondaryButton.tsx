import React from 'react';
import { Pressable, Text, View, StyleSheet, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface SecondaryButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function SecondaryButton({ label, onPress, disabled, icon }: SecondaryButtonProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: spacing.base,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[typography.button, { color: colors.textPrimary }]}>{label}</Text>
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.textPrimary} style={{ marginLeft: spacing.xs }} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
