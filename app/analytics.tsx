import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme';
import { AppHeader } from '../src/components/AppHeader';
import { AppRefreshControl } from '../src/components/AppRefreshControl';
import { ThemeAwareCard } from '../src/components/ThemeAwareCard';
import { StatTile } from '../src/components/StatTile';
import { SectionHeader } from '../src/components/SectionHeader';
import { CustomerAvatar } from '../src/components/CustomerAvatar';
import { RevenueTrendChart } from '../src/components/RevenueTrendChart';
import { EmptyState } from '../src/components/EmptyState';
import { useRequestStore } from '../src/store/requestStore';
import { useCustomerStore } from '../src/store/customerStore';
import { useTransactionStore } from '../src/store/transactionStore';
import { useRequestDraftStore } from '../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../src/store/paymentDefaultsStore';
import { useRefreshCustomerData } from '../src/store/useRefreshCustomerData';
import { formatCurrency } from '../src/utils/formatCurrency';
import {
  getRevenueSummary,
  getOutstandingSummary,
  getAvgPaymentTimeSummary,
  getPaymentOverview,
  getTopCustomers,
  getRevenueTrend,
  type RevenueTrendPeriod,
} from '../src/utils/analytics';

const PERIODS: RevenueTrendPeriod[] = ['7D', '30D', '3M', '6M', '1Y'];

export default function AnalyticsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const requests = useRequestStore((state) => state.requests);
  const customers = useCustomerStore((state) => state.customers);
  const transactions = useTransactionStore((state) => state.transactions);
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  const { refresh, isRefreshing } = useRefreshCustomerData();
  const [period, setPeriod] = useState<RevenueTrendPeriod>('30D');

  // A single `now`, computed once per mount rather than inside every
  // calculation below -- every summary below reads it, and only this one
  // needs to change if this screen ever wants a live-ticking clock.
  const now = useMemo(() => new Date(), []);

  const revenue = useMemo(() => getRevenueSummary(transactions, now), [transactions, now]);
  const outstanding = useMemo(() => getOutstandingSummary(requests), [requests]);
  const avgPaymentTime = useMemo(() => getAvgPaymentTimeSummary(requests, transactions, now), [requests, transactions, now]);
  const overview = useMemo(() => getPaymentOverview(requests, now), [requests, now]);
  const topCustomers = useMemo(() => getTopCustomers(transactions, 5), [transactions]);
  const trend = useMemo(() => getRevenueTrend(transactions, period, now), [transactions, period, now]);

  const customerById = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    for (const customer of customers) map.set(customer.id, customer);
    return map;
  }, [customers]);

  function handleCreateRequest() {
    startFresh(defaultExpiryOption);
    router.push('/request/amount');
  }

  // The empty state is specifically "nothing to analyze yet" -- a merchant
  // with open requests but no payments yet still has real, non-fabricated
  // Outstanding/Payment Overview data worth showing (e.g. "$2,300 across 5
  // unpaid requests, 1 overdue"). Gating on transactions alone hid that
  // behind a "receive your first payment" message that was simply wrong
  // for their actual situation -- only gate on having neither.
  const hasAnyData = transactions.length > 0 || requests.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <AppHeader title="Analytics" onBackPress={() => router.back()} />

      {!hasAnyData ? (
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <EmptyState
            icon="bar-chart-outline"
            title="Your analytics will appear here"
            description="Receive your first payment to unlock revenue and customer insights."
            actionLabel="Create Request"
            onActionPress={handleCreateRequest}
          />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          // A clear, literal 20px of visual breathing room below the last
          // card, then the device's own real bottom safe-area inset -- not
          // a guessed flat constant standing in for both. This screen has
          // no bottom tab bar under it (see the routing note below), so
          // insets.bottom is the only additional clearance actually needed.
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 20 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        >
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.lg }]}>
            Your business at a glance
          </Text>

          {/* Revenue hero -- the single dominant element on this screen. */}
          <ThemeAwareCard variant="hero" style={{ padding: spacing.xl }}>
            <Text style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted }]}>Revenue this month</Text>
            <Text style={[typography.display, { color: colors.heroSurfaceText, marginTop: spacing.xs }]} numberOfLines={1}>
              {formatCurrency(revenue.thisMonth)}
            </Text>
            {revenue.changePercent !== null ? (
              <View style={[styles.trendRow, { marginTop: spacing.sm }]}>
                <Ionicons
                  name={revenue.changePercent >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={13}
                  color={revenue.changePercent >= 0 ? colors.success : colors.error}
                />
                <Text
                  style={[
                    typography.bodySmall,
                    { color: revenue.changePercent >= 0 ? colors.success : colors.error, marginLeft: spacing.xs / 2 },
                  ]}
                >
                  {Math.abs(revenue.changePercent).toFixed(1)}% from last month
                </Text>
              </View>
            ) : null}
          </ThemeAwareCard>

          {/* Two supporting metrics only -- never squeezed into a 3rd column. */}
          <View style={[styles.metricsRow, { marginTop: spacing.xl, gap: spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <StatTile label="Outstanding" value={formatCurrency(outstanding.amount)} />
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs, marginLeft: spacing.xs }]}>
                {outstanding.count} unpaid {outstanding.count === 1 ? 'request' : 'requests'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <StatTile label="Avg. Payment Time" value={avgPaymentTime.days !== null ? `${avgPaymentTime.days.toFixed(1)}d` : '—'} />
              {avgPaymentTime.isFasterThanLastMonth !== null ? (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs, marginLeft: spacing.xs }]}>
                  {avgPaymentTime.isFasterThanLastMonth ? 'Faster' : 'Slower'} than last month
                </Text>
              ) : null}
            </View>
          </View>

          {/* Revenue trend. */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Revenue Trend" />
            <View style={[styles.periodRow, { marginBottom: spacing.md, gap: spacing.xs }]}>
              {PERIODS.map((option) => {
                const isActive = option === period;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setPeriod(option)}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${option} revenue trend`}
                    accessibilityState={{ selected: isActive }}
                    style={({ pressed }) => [
                      styles.periodChip,
                      {
                        backgroundColor: isActive ? colors.heroSurface : colors.surface,
                        borderColor: colors.border,
                        borderRadius: radius.full,
                        opacity: pressed ? 0.7 : 1,
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[typography.caption, { color: isActive ? colors.heroSurfaceText : colors.textSecondary }]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <ThemeAwareCard style={{ paddingBottom: spacing.sm }}>
              <RevenueTrendChart points={trend} />
            </ThemeAwareCard>
          </View>

          {/* Payment overview -- 3 rows in one card, not 3 mini-cards. */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Payment Overview" />
            <ThemeAwareCard>
              <OverviewRow dotColor={colors.success} label="Paid" value={overview.paidCount} />
              <OverviewRow dotColor={colors.pending} label="Outstanding" value={overview.outstandingCount} />
              <OverviewRow dotColor={colors.error} label="Overdue" value={overview.overdueCount} last />
            </ThemeAwareCard>
          </View>

          {/* Top customers. */}
          {topCustomers.length > 0 ? (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Top Customers" />
              <ThemeAwareCard>
                {topCustomers.map((entry, index) => {
                  const customer = customerById.get(entry.customerId);
                  return (
                    <Pressable
                      key={entry.customerId}
                      onPress={() => router.push(`/(app)/customers/${entry.customerId}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${customer?.name ?? 'Former customer'}, ${formatCurrency(entry.totalReceived)} received`}
                      style={({ pressed }) => [
                        styles.customerRow,
                        {
                          paddingVertical: spacing.sm,
                          marginTop: index === 0 ? 0 : spacing.sm,
                          opacity: pressed ? 0.7 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        },
                      ]}
                    >
                      <CustomerAvatar
                        name={customer?.name ?? 'Former customer'}
                        color={customer?.avatarColor ?? 'blue'}
                        avatarUrl={customer?.avatarUrl}
                        imageType={customer?.imageType}
                        size={40}
                      />
                      <View style={{ marginLeft: spacing.md, flex: 1 }}>
                        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                          {customer?.name ?? 'Former customer'}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                          {entry.paymentCount} {entry.paymentCount === 1 ? 'payment' : 'payments'}
                        </Text>
                      </View>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginRight: spacing.xs }]} numberOfLines={1}>
                        {formatCurrency(entry.totalReceived)}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
              </ThemeAwareCard>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function OverviewRow({ dotColor, label, value, last }: { dotColor: string; label: string; value: number; last?: boolean }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View
      style={[
        styles.overviewRow,
        { paddingVertical: spacing.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor, borderRadius: radius.full }]} />
      <Text style={[typography.body, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>{label}</Text>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  trendRow: { flexDirection: 'row', alignItems: 'center' },
  metricsRow: { flexDirection: 'row' },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap' },
  periodChip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  customerRow: { flexDirection: 'row', alignItems: 'center' },
  overviewRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8 },
});
