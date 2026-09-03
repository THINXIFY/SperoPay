import React, { useCallback, useRef } from 'react';
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

  // These are handed down to NumericKeypad -> KeypadKey (memoized, 12
  // instances) as a single shared callback. For that memo to actually block
  // anything, the callback's identity must stay stable across renders --
  // but `value` is, by definition, different on every render (that's what
  // typing is). Reading the latest value from a ref instead of closing over
  // the prop keeps these callbacks referentially stable while still always
  // acting on the current input.
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleKeyPress = useCallback(
    (key: string) => {
      const current = valueRef.current;
      if (key === '.' && current.includes('.')) return;

      const [integer, decimals] = current.split('.');
      if (decimals && decimals.length >= MAX_DECIMAL_PLACES) return;

      if (key !== '.' && !current.includes('.') && integer.length >= MAX_INTEGER_DIGITS) return;

      if (current === '0' && key !== '.') {
        onChange(key);
        return;
      }

      onChange(current + key);
    },
    [onChange]
  );

  const handleDelete = useCallback(() => {
    const current = valueRef.current;
    onChange(current.length > 1 ? current.slice(0, -1) : '0');
  }, [onChange]);

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
