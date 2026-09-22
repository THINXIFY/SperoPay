import { useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme/useTheme';
import { AppHeader } from '../src/components/AppHeader';
import { AppRefreshControl } from '../src/components/AppRefreshControl';
import { ThemeAwareCard } from '../src/components/ThemeAwareCard';
import { StatTile } from '../src/components/StatTile';
import { SectionLabel } from '../src/components/SectionLabel';
import { EmptyState } from '../src/components/EmptyState';
import { RecurringPlanCard } from '../src/components/RecurringPlanCard';
import { useRecurringPlanStore } from '../src/store/recurringPlanStore';
import { useReminderStore } from '../src/store/reminderStore';
import { useRequestStore } from '../src/store/requestStore';
import { useCustomerStore } from '../src/store/customerStore';
import { useAuthStore } from '../src/store/authStore';
import { formatCurrency } from '../src/utils/formatCurrency';
import { formatReminderMoment } from '../src/utils/reminderSchedule';
import { friendlyReminderReason } from '../src/utils/reminderPresentation';
import type { Customer, PaymentRequest } from '../src/types';

const UPCOMING_REMINDER_PREVIEW_COUNT = 5;

// Phase 5C: a lightweight, merchant-facing summary of Spero's server-side
// automation -- deliberately not a BI dashboard (spec: "avoid excessive
// dashboard complexity"). Three plain counts, then three short lists, each
// linking back to the real screen that manages that thing (this screen
// itself has no management actions of its own).
export default function AutomationOverviewScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const userId = useAuthStore((state) => state.user?.id);
  const plans = useRecurringPlanStore((state) => state.plans);
  const plansStatus = useRecurringPlanStore((state) => state.status);
  const loadPlans = useRecurringPlanStore((state) => state.loadForUser);
  const remindersAll = useReminderStore((state) => state.remindersAll);
  const remindersAllStatus = useReminderStore((state) => state.allStatus);
  const loadAllReminders = useReminderStore((state) => state.loadAllForUser);
  const requests = useRequestStore((state) => state.requests);
  const customers = useCustomerStore((state) => state.customers);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadPlans(userId);
        loadAllReminders(userId);
      }
    }, [userId, loadPlans, loadAllReminders])
  );

  const requestById = useMemo(() => {
    const map = new Map<string, PaymentRequest>();
    for (const request of requests) map.set(request.id, request);
    return map;
  }, [requests]);
  const customerById = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const customer of customers) map.set(customer.id, customer);
    return map;
  }, [customers]);

  const activePlans = useMemo(() => plans.filter((p) => p.active), [plans]);
  const strugglingPlans = useMemo(() => activePlans.filter((p) => (p.consecutiveFailures ?? 0) > 0), [activePlans]);

  const upcomingReminders = useMemo(
    () =>
      remindersAll
        .filter((r) => r.status === 'scheduled')
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()),
    [remindersAll]
  );
  const failedReminders = useMemo(() => remindersAll.filter((r) => r.status === 'failed'), [remindersAll]);

  const needsAttentionCount = strugglingPlans.length + failedReminders.length;

  const isRefreshing = plansStatus === 'loading' || remindersAllStatus === 'loading';

  function handleRefresh() {
    if (userId) {
      loadPlans(userId);
      loadAllReminders(userId);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Automation" onBackPress={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatTile label="Active plans" value={String(activePlans.length)} style={{ flex: 1 }} />
          <StatTile label="Scheduled reminders" value={String(upcomingReminders.length)} style={{ flex: 1 }} />
          <StatTile
            label="Needs attention"
            value={String(needsAttentionCount)}
            style={{ flex: 1, borderColor: needsAttentionCount > 0 ? colors.error : colors.border }}
          />
        </View>

        <View>
          <View style={[styles.sectionHeaderRow, { marginBottom: spacing.sm }]}>
            <Text style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.6 }]}>RECURRING PAYMENTS</Text>
            <Pressable onPress={() => router.push('/recurring')} accessibilityRole="button" accessibilityLabel="Manage recurring payments">
              <Text style={[typography.bodySmall, { color: colors.primaryAction }]}>Manage</Text>
            </Pressable>
          </View>
          {activePlans.length === 0 ? (
            <ThemeAwareCard>
              <EmptyState
                icon="repeat-outline"
                title="No recurring payments yet"
                description="Automate repeat billing for regular customers."
                actionLabel="Create recurring plan"
                onActionPress={() => router.push('/recurring/create')}
              />
            </ThemeAwareCard>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {activePlans.slice(0, UPCOMING_REMINDER_PREVIEW_COUNT).map((plan) => (
                <RecurringPlanCard
                  key={plan.id}
                  plan={plan}
                  customer={customers.find((c) => c.id === plan.customerId)}
                  onPress={() => router.push('/recurring')}
                  onMorePress={() => router.push('/recurring')}
                />
              ))}
            </View>
          )}
        </View>

        <View>
          <SectionLabel>REMINDERS</SectionLabel>
          {upcomingReminders.length === 0 ? (
            <ThemeAwareCard>
              <EmptyState
                icon="notifications-outline"
                title="No reminders scheduled"
                description="Add reminders so customers don't miss payment dates."
              />
            </ThemeAwareCard>
          ) : (
            <ThemeAwareCard>
              {upcomingReminders.slice(0, UPCOMING_REMINDER_PREVIEW_COUNT).map((reminder, index) => {
                const request = requestById.get(reminder.paymentRequestId);
                const customer = request?.customerId ? customerById.get(request.customerId) : undefined;
                const who = request?.description || customer?.name || 'No customer';
                return (
                  <Pressable
                    key={reminder.id}
                    onPress={() => router.push(`/(app)/requests/${reminder.paymentRequestId}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Reminder for ${who}`}
                    style={[
                      styles.row,
                      { marginTop: index === 0 ? 0 : spacing.md, paddingTop: index === 0 ? 0 : spacing.md, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border },
                    ]}
                  >
                    <View style={[styles.iconChip, { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.background }]}>
                      <Ionicons name="alarm-outline" size={15} color={colors.textSecondary} />
                    </View>
                    <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                        {who}
                        {request ? ` · ${formatCurrency(request.amount)} ${request.currency}` : ''}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                        {formatReminderMoment(reminder.scheduledFor)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ThemeAwareCard>
          )}
        </View>

        {needsAttentionCount > 0 ? (
          <View>
            <SectionLabel>NEEDS ATTENTION</SectionLabel>
            <ThemeAwareCard>
              {strugglingPlans.map((plan, index) => (
                <Pressable
                  key={`plan-${plan.id}`}
                  onPress={() => router.push('/recurring')}
                  accessibilityRole="button"
                  style={[
                    styles.row,
                    { marginTop: index === 0 ? 0 : spacing.md, paddingTop: index === 0 ? 0 : spacing.md, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border },
                  ]}
                >
                  <Ionicons name="warning" size={16} color={colors.error} />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                      {plan.description || 'Recurring payment'}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                      Hasn't generated its last request -- we'll keep retrying automatically.
                    </Text>
                  </View>
                </Pressable>
              ))}
              {failedReminders.map((reminder, index) => {
                const request = requestById.get(reminder.paymentRequestId);
                const who = request?.description || (request?.customerId ? customerById.get(request.customerId)?.name : undefined) || 'a request';
                return (
                  <Pressable
                    key={`reminder-${reminder.id}`}
                    onPress={() => router.push(`/(app)/requests/${reminder.paymentRequestId}`)}
                    accessibilityRole="button"
                    style={[
                      styles.row,
                      {
                        marginTop: index === 0 && strugglingPlans.length === 0 ? 0 : spacing.md,
                        paddingTop: index === 0 && strugglingPlans.length === 0 ? 0 : spacing.md,
                        borderTopWidth: index === 0 && strugglingPlans.length === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons name="warning" size={16} color={colors.error} />
                    <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                        Reminder couldn't be sent
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={2}>
                        {who} · {friendlyReminderReason(reminder.lastError) ?? "We'll retry automatically."}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ThemeAwareCard>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconChip: { alignItems: 'center', justifyContent: 'center' },
});
