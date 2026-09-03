import React from 'react';
import { Pressable, Text, GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface TextButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  // 'danger' is for a de-emphasized destructive action (Cancel Request,
  // Delete) that must read as available but never compete visually with a
  // screen's primary CTA -- a full-width bordered SecondaryButton in the
  // same stack reads as equally important, which a destructive action
  // never should.
  tone?: 'default' | 'danger';
}

export function TextButton({ label, onPress, disabled, tone = 'default' }: TextButtonProps) {
  const { colors, spacing, typography } = useTheme();
  const color = tone === 'danger' ? colors.error : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => ({ alignItems: 'center', paddingVertical: spacing.sm, opacity: disabled ? 0.5 : pressed ? 0.6 : 1 })}
    >
      <Text style={[typography.bodyMedium, { color }]}>{label}</Text>
    </Pressable>
  );
}
