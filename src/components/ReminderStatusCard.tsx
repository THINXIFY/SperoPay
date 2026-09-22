import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { ThemeAwareCard } from './ThemeAwareCard';
import { SecondaryButton } from './SecondaryButton';
import { PrimaryButton } from './PrimaryButton';
import { formatReminderMoment, reminderScheduleSummary, rulesForPreset } from '../utils/reminderSchedule';
import { friendlyReminderReason } from '../utils/reminderPresentation';
import type { PaymentRequestStatus, Reminder, ReminderSchedule } from '../types';

interface ReminderStatusCardProps {
  requestStatus: PaymentRequestStatus;
  paidAt?: string;
  schedule: ReminderSchedule | undefined;
  reminders: Reminder[];
  onManage: () => void;
  onSendNow: () => void;
  sendNowDisabled?: boolean;
}

interface Pill {
  label: string;
  tone: 'active' | 'paused' | 'stopped' | 'failed';
}

function pillColors(tone: Pill['tone'], colors: ReturnType<typeof useTheme>['colors']) {
  switch (tone) {
    case 'active':
      return { bg: colors.softMint, text: colors.softMintText };
    case 'failed':
      return { bg: colors.softRed, text: colors.softRedText };
    default:
      return { bg: colors.background, text: colors.textMuted };
  }
}

// The one place "is a reminder happening for this request right now"
// is decided for display -- Request Detail is the only consumer today,
// but this logic deliberately doesn't live inline there so it can't
// silently diverge from what the server-side processor actually does
// (paid/cancelled -> hard stop; confirming -> paused, not stopped; a
// disabled schedule reads as off, not failed).
export function ReminderStatusCard({
  requestStatus,
  paidAt,
  schedule,
  reminders,
  onManage,
  onSendNow,
  sendNowDisabled,
}: ReminderStatusCardProps) {
  const theme = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const nextReminder = reminders
    .filter((r) => r.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];
  const lastFailed = [...reminders].reverse().find((r) => r.status === 'failed');
  const rules = schedule ? rulesForPreset(schedule.preset, schedule.customRules) : [];

  if (requestStatus === 'paid') {
    return (
      <ThemeAwareCard>
        <CardHeader icon="checkmark-circle-outline" title="Reminders stopped" pill={{ label: 'Paid', tone: 'stopped' }} theme={theme} />
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          {paidAt ? `Payment received ${new Date(paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.` : 'Payment received.'}
        </Text>
      </ThemeAwareCard>
    );
  }

  if (requestStatus === 'cancelled' || requestStatus === 'expired') {
    return (
      <ThemeAwareCard>
        <CardHeader icon="notifications-off-outline" title="Reminders stopped" pill={{ label: 'Stopped', tone: 'stopped' }} theme={theme} />
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          {requestStatus === 'cancelled' ? 'This request was cancelled.' : 'This request expired.'}
        </Text>
      </ThemeAwareCard>
    );
  }

  if (requestStatus === 'confirming') {
    return (
      <ThemeAwareCard>
        <CardHeader icon="sync-outline" title="Payment detected" pill={{ label: 'Paused', tone: 'paused' }} theme={theme} />
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          Reminders are paused while the payment is being confirmed.
        </Text>
      </ThemeAwareCard>
    );
  }

  if (!schedule || !schedule.enabled) {
    return (
      <ThemeAwareCard>
        <CardHeader icon="notifications-outline" title="No reminders scheduled" theme={theme} />
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.base }]}>
          Add reminders so customers don't miss payment dates.
        </Text>
        <SecondaryButton label="Enable reminders" onPress={onManage} />
      </ThemeAwareCard>
    );
  }

  return (
    <ThemeAwareCard>
      <CardHeader icon="notifications-outline" title="Smart Reminders" pill={{ label: 'Active', tone: 'active' }} theme={theme} />

      {lastFailed ? (
        <View
          style={[styles.failureNote, { backgroundColor: colors.softRed, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm }]}
        >
          <Ionicons name="warning-outline" size={14} color={colors.softRedText} />
          <Text style={[typography.caption, { color: colors.softRedText, marginLeft: spacing.xs, flex: 1 }]}>
            {lastFailed.attemptCount >= 3
              ? friendlyReminderReason(lastFailed.lastError) ?? 'Reminder delivery failed.'
              : "Reminder couldn't be sent. We'll try again automatically."}
          </Text>
        </View>
      ) : null}

      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.base }]}>Next reminder</Text>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
        {nextReminder ? formatReminderMoment(nextReminder.scheduledFor) : 'None upcoming'}
      </Text>

      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.base }]} numberOfLines={2}>
        {reminderScheduleSummary(rules)}
      </Text>

      {/* Phase 5C honesty requirement: scheduling is fully real, but nothing
          in this codebase automatically delivers a reminder yet (see
          deliveryProvider.ts's NullDeliveryProvider) -- a merchant relying
          on "Smart Reminders" alone would never notice their customer was
          never actually contacted. Shown unconditionally while active,
          never only after a failure, since this is true from the moment
          reminders are turned on, not just once one has already fired. */}
      <View
        style={[styles.deliveryNote, { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.base }]}
      >
        <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
        <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.xs, flex: 1 }]}>
          Automatic delivery isn't connected for this account yet -- use Send Now to notify the customer yourself.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Manage" onPress={onManage} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Send now" onPress={onSendNow} disabled={sendNowDisabled} />
        </View>
      </View>
    </ThemeAwareCard>
  );
}

function CardHeader({
  icon,
  title,
  pill,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  pill?: Pill;
  theme: ReturnType<typeof useTheme>;
}) {
  const { colors, spacing, radius, typography } = theme;
  return (
    <View style={styles.headerRow}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>{title}</Text>
      {pill ? (
        <View
          style={[
            styles.pill,
            { backgroundColor: pillColors(pill.tone, colors).bg, borderRadius: radius.full, paddingHorizontal: spacing.sm },
          ]}
        >
          <Text style={[typography.caption, { color: pillColors(pill.tone, colors).text }]}>{pill.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  pill: { paddingVertical: 3 },
  failureNote: { flexDirection: 'row', alignItems: 'center' },
  deliveryNote: { flexDirection: 'row', alignItems: 'center' },
});
