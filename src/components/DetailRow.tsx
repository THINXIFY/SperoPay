import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface DetailRowProps {
  label: string;
  value: string;
  // Omits the bottom hairline -- pass on the last row in a group.
  last?: boolean;
}

// A compact label/value row for financial-document-style detail lists
// (Request Detail, Invoice, Receipt, Public Checkout) -- replaces the
// previous pattern of a stacked caption-then-body Text pair per field,
// which read as a long scrolling form rather than a document.
export function DetailRow({ label, value, last }: DetailRowProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { paddingVertical: spacing.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[typography.bodySmall, { color: colors.textPrimary, flex: 1, textAlign: 'right', marginLeft: spacing.md }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
