import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface KeypadKeyProps {
  value: string;
  onPress: () => void;
}

export function KeypadKey({ value, onPress }: KeypadKeyProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const isDelete = value === 'delete';
  const isDecimal = value === '.';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        {
          paddingVertical: spacing.base,
          borderRadius: radius.lg,
          backgroundColor: pressed ? colors.surface : 'transparent',
          opacity: pressed ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={isDecimal ? 'Decimal point' : isDelete ? 'Delete' : `Digit ${value}`}
      hitSlop={4}
    >
      {isDelete ? (
        <Ionicons name="backspace-outline" size={24} color={colors.textSecondary} />
      ) : (
        <Text
          style={[typography.h1, { color: isDecimal ? colors.textSecondary : colors.textPrimary }]}
        >
          {value}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  key: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
