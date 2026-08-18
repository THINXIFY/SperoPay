import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { StatusBadge } from './StatusBadge';
import { formatCurrency } from '../utils/formatCurrency';
import type { PaymentRequestStatus } from '../types';

interface RequestCardProps {
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: PaymentRequestStatus;
  dateLabel: string;
  onPress?: () => void;
}

export function RequestCard({ title, description, amount, currency, status, dateLabel, onPress }: RequestCardProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.base,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
          {formatCurrency(amount)} {currency}
        </Text>
      </View>
      {description ? (
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs / 2 }]}>
          {description}
        </Text>
      ) : null}
      <View style={[styles.footerRow, { marginTop: spacing.sm }]}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{dateLabel}</Text>
        <StatusBadge status={status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
