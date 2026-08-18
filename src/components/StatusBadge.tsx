import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { PaymentRequestStatus } from '../types';

const LABELS: Record<PaymentRequestStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  expired: 'Expired',
};

export const COLOR_KEYS: Record<PaymentRequestStatus, 'pending' | 'success' | 'expired'> = {
  pending: 'pending',
  paid: 'success',
  expired: 'expired',
};

export function StatusBadge({ status }: { status: PaymentRequestStatus }) {
  const { colors, spacing, radius, typography } = useTheme();
  const color = colors[COLOR_KEYS[status]];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: `${color}26`,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs / 2,
        },
      ]}
    >
      <Text style={[typography.caption, { color }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
});
