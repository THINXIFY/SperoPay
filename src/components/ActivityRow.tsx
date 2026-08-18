import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { CustomerAvatar } from './CustomerAvatar';
import { StatusBadge, COLOR_KEYS } from './StatusBadge';
import { formatCurrency } from '../utils/formatCurrency';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import type { Customer, PaymentRequestStatus } from '../types';

interface ActivityRowProps {
  customerName: string;
  avatarColor: Customer['avatarColor'];
  amount: number;
  currency: string;
  status: PaymentRequestStatus;
  createdAt: string;
}

export function ActivityRow({ customerName, avatarColor, amount, currency, status, createdAt }: ActivityRowProps) {
  const { colors, spacing, typography } = useTheme();
  const amountColor = colors[COLOR_KEYS[status]];

  return (
    <View style={[styles.row, { paddingVertical: spacing.md }]}>
      <CustomerAvatar name={customerName} color={avatarColor} />
      <View style={[styles.middle, { marginLeft: spacing.md }]}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{customerName}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{currency}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[typography.bodyMedium, { color: amountColor }]}>
          {status === 'paid' ? '+' : ''}
          {formatCurrency(amount)}
        </Text>
        <View style={[styles.rightMeta, { marginTop: spacing.xs }]}>
          <StatusBadge status={status} />
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.xs }]}>
            {formatRelativeTime(createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  middle: { flex: 1 },
  right: { alignItems: 'flex-end' },
  rightMeta: { flexDirection: 'row', alignItems: 'center' },
});
