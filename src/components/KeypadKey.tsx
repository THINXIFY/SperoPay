import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface KeypadKeyProps {
  value: string;
  onPress: (value: string) => void;
}

// Memoized because NumericKeypad renders 12 of these, and AmountInput's
// parent re-renders on every digit tap (the amount lives in a store, not
// local state) -- without this, every keystroke would re-render all 12
// keys just to update the one Text node that actually changed. Only
// effective because `onPress` below is a single stable callback shared by
// every key (see NumericKeypad), not a fresh closure per key per render.
export const KeypadKey = React.memo(function KeypadKey({ value, onPress }: KeypadKeyProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const isDelete = value === 'delete';
  const isDecimal = value === '.';

  function handlePress() {
    onPress(value);
  }

  return (
    <Pressable
      onPress={handlePress}
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
});

const styles = StyleSheet.create({
  key: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
