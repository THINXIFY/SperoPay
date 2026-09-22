import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { ThemeAwareCard } from './ThemeAwareCard';
import { recurringFrequencyLabel, formatRecurringDate } from '../utils/recurringSchedule';
import type { RecurringPlan, Customer } from '../types';

interface RecurringPlanCardProps {
  plan: RecurringPlan;
  customer: Customer | undefined;
  onPress: () => void;
  onMorePress: () => void;
}

// Deliberately compact -- one line of identity, one line of amount +
// frequency, a status pill, and the single most useful forward-looking
// fact ("Next request"). No paid-so-far/occurrence-count clutter here (the
// spec calls that out as optional and "where useful" -- a list card isn't
// that place; it lives on the plan's own detail view instead).
export function RecurringPlanCard({ plan, customer, onPress, onMorePress }: RecurringPlanCardProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const isEnded = !plan.active && plan.maxOccurrences != null && plan.occurrencesGenerated >= plan.maxOccurrences;
  const statusLabel = isEnded ? 'Ended' : plan.active ? 'Active' : 'Paused';
  const statusColors = isEnded
    ? { bg: colors.background, text: colors.textMuted }
    : plan.active
      ? { bg: colors.softMint, text: colors.softMintText }
      : { bg: colors.softBlue, text: colors.softBlueText };
  // Phase 5C: a plan that has failed to generate its most recent occurrence
  // keeps retrying on its own (see process-recurring-plans/index.ts --
  // consecutiveFailures never stops or bounds a retry, it's purely
  // observational) -- this is the one place that failure becomes visible to
  // the merchant, restrained to a small icon rather than a loud banner.
  const needsAttention = plan.active && (plan.consecutiveFailures ?? 0) > 0;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={plan.description ?? 'Recurring payment plan'}>
      <ThemeAwareCard>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
              {plan.description || 'Recurring payment'}
            </Text>
            {customer ? (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                {customer.name}
              </Text>
            ) : null}
          </View>
          {needsAttention ? (
            <Ionicons
              name="warning"
              size={16}
              color={colors.error}
              style={{ marginRight: spacing.sm }}
              accessibilityLabel="Needs attention"
            />
          ) : null}
          <Pressable onPress={onMorePress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Manage plan">
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
          {plan.amount} {plan.currency} · {recurringFrequencyLabel(plan.frequency, plan.customIntervalDays)}
        </Text>

        {needsAttention ? (
          <Text style={[typography.caption, { color: colors.error, marginTop: spacing.xs / 2 }]}>
            Hasn't generated its last request -- we'll keep retrying automatically.
          </Text>
        ) : null}

        <View style={[styles.footerRow, { marginTop: spacing.base, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }]}>
          <View
            style={[styles.pill, { backgroundColor: statusColors.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm }]}
          >
            <Text style={[typography.caption, { color: statusColors.text }]}>{statusLabel}</Text>
          </View>
          {!isEnded && plan.active ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Next request</Text>
              <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{formatRecurringDate(plan.nextRunAt)}</Text>
            </View>
          ) : null}
        </View>
      </ThemeAwareCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingVertical: 3 },
});
