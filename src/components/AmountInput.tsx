import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { NumericKeypad } from './NumericKeypad';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_DECIMAL_PLACES = 2;
const MAX_INTEGER_DIGITS = 9;

// Adds thousands separators to the integer part for display only -- the raw,
// unformatted digit string stays the source of truth (stored in the draft
// and used for validation), so this never has to reconcile commas with
// cursor position or backspacing.
function formatAmountDisplay(raw: string): string {
  const [integerPart, decimalPart] = raw.split('.');
  const formattedInteger = (Number(integerPart) || 0).toLocaleString('en-US');
  return decimalPart === undefined ? formattedInteger : `${formattedInteger}.${decimalPart}`;
}

export function AmountInput({ value, onChange }: AmountInputProps) {
  const { colors, spacing, typography } = useTheme();

  function handleKeyPress(key: string) {
    if (key === '.' && value.includes('.')) return;

    const [integer, decimals] = value.split('.');
    if (decimals && decimals.length >= MAX_DECIMAL_PLACES) return;

    if (key !== '.' && !value.includes('.') && integer.length >= MAX_INTEGER_DIGITS) return;

    if (value === '0' && key !== '.') {
      onChange(key);
      return;
    }

    onChange(value + key);
  }

  function handleDelete() {
    onChange(value.length > 1 ? value.slice(0, -1) : '0');
  }

  return (
    <View>
      <View style={[styles.display, { marginBottom: spacing.lg }]}>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>Amount</Text>
        <Text
          style={[typography.display, { color: colors.textPrimary, fontVariant: ['tabular-nums'] }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          maxFontSizeMultiplier={1.3}
        >
          ${formatAmountDisplay(value)}
        </Text>
      </View>
      <NumericKeypad onKeyPress={handleKeyPress} onDelete={handleDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  display: { alignItems: 'center' },
});
