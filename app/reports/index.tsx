import { useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { StatTile } from '../../src/components/StatTile';
import { EmptyState } from '../../src/components/EmptyState';
import { ReportDateRangeTrigger } from '../../src/components/reports/ReportDateRangeTrigger';
import { ReportDateRangeSheet } from '../../src/components/reports/ReportDateRangeSheet';
import { ReportCategoryCard } from '../../src/components/reports/ReportCategoryCard';
import { CurrencyFilterChips } from '../../src/components/CurrencyFilterChips';
import { useReportsData } from '../../src/store/useReportsData';
import { useReportsFilterStore } from '../../src/store/reportsFilterStore';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../../src/store/paymentDefaultsStore';
import { getReportsSummary } from '../../src/utils/reportsCalculations';
import { formatCurrency } from '../../src/utils/formatCurrency';

export default function ReportsHomeScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    requests,
    customers,
    transactions,
    range,
    previousRange,
    rangeLabel,
    now,
    refresh,
    isRefreshing,
    currencies,
    selectedCurrency,
    setCurrency,
  } = useReportsData();

  const datePreset = useReportsFilterStore((state) => state.datePreset);
  const customStartIso = useReportsFilterStore((state) => state.customStartIso);
  const customEndIso = useReportsFilterStore((state) => state.customEndIso);
  const setDatePreset = useReportsFilterStore((state) => state.setDatePreset);
  const setCustomRange = useReportsFilterStore((state) => state.setCustomRange);

  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  const defaultCurrency = usePaymentDefaultsStore((state) => state.defaultCurrency);

  const dateSheetRef = useRef<BottomSheet>(null);
  const [isDateSheetMounted, setIsDateSheetMounted] = useState(false);

  function openDateSheet() {
    if (isDateSheetMounted) {
      dateSheetRef.current?.expand();
    } else {
      setIsDateSheetMounted(true);
    }
  }

  const summary = getReportsSummary(transactions, requests, range, previousRange, now);
  const hasAnyData = requests.length > 0 || customers.length > 0;

  function handleCreateRequest() {
    startFresh(defaultExpiryOption, defaultCurrency);
    router.push('/request/amount');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <AppHeader title="Reports" onBackPress={() => router.back()} />

      {!hasAnyData ? (
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <EmptyState
            icon="bar-chart-outline"
            title="Your reports will appear here"
            description="Create your first payment request to start building business records."
            actionLabel="Create Request"
            onActionPress={handleCreateRequest}
          />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        >
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.base }]}>
            Understand your payment activity and export business records.
          </Text>

          <ReportDateRangeTrigger label={rangeLabel} onPress={openDateSheet} />

          <View style={{ marginTop: spacing.md }}>
            <CurrencyFilterChips currencies={currencies} selected={selectedCurrency} onSelect={setCurrency} />
          </View>

          {/* Primary hero -- Total Received is the one dominant number, in
              the currently selected asset only (never a combined figure
              across assets -- spec section 14). */}
          <ThemeAwareCard variant="hero" style={{ padding: spacing.xl, marginTop: spacing.lg }}>
            <Text style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted }]}>Total Received</Text>
            <Text style={[typography.display, { color: colors.heroSurfaceText, marginTop: spacing.xs }]} numberOfLines={1}>
              {formatCurrency(summary.totalReceived)} {selectedCurrency}
            </Text>
            {summary.changePercent !== null ? (
              <View style={[styles.trendRow, { marginTop: spacing.sm }]}>
                <Ionicons
                  name={summary.changePercent >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={13}
                  color={summary.changePercent >= 0 ? colors.success : colors.error}
                />
                <Text
                  style={[
                    typography.bodySmall,
                    { color: summary.changePercent >= 0 ? colors.success : colors.error, marginLeft: spacing.xs / 2 },
                  ]}
                >
                  {Math.abs(summary.changePercent).toFixed(1)}% vs previous period
                </Text>
              </View>
            ) : null}
          </ThemeAwareCard>

          {/* Supporting metrics -- a compact 2-column grid, never squeezed
              equal-size cards past what's actually useful (Overdue only
              appears when there's something to flag). */}
          <View style={[styles.metricsGrid, { marginTop: spacing.lg, gap: spacing.sm }]}>
            <StatTile label="Outstanding" value={`${formatCurrency(summary.outstanding)} ${selectedCurrency}`} style={styles.metricTile} />
            <StatTile label="Payments" value={String(summary.paymentsCount)} style={styles.metricTile} />
            <StatTile label="Avg. Payment" value={`${formatCurrency(summary.averagePayment)} ${selectedCurrency}`} style={styles.metricTile} />
            {summary.overdueCount > 0 ? (
              <StatTile label="Overdue" value={String(summary.overdueCount)} style={styles.metricTile} />
            ) : null}
          </View>

          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xxl, marginBottom: spacing.md }]}>
            Reports
          </Text>

          <ReportCategoryCard
            icon="cash-outline"
            title="Payments"
            description="Verified payments received"
            onPress={() => router.push('/reports/payments')}
          />
          <ReportCategoryCard
            icon="trending-up-outline"
            title="Revenue"
            description="Revenue trends over time"
            onPress={() => router.push('/reports/revenue')}
          />
          <ReportCategoryCard
            icon="time-outline"
            title="Outstanding"
            description="Pending, partial, and overdue balances"
            onPress={() => router.push('/reports/outstanding')}
          />
          <ReportCategoryCard
            icon="people-outline"
            title="Customers"
            description="Customer contribution and performance"
            onPress={() => router.push('/reports/customers')}
          />
          <ReportCategoryCard
            icon="document-text-outline"
            title="Requests"
            description="Payment request status breakdown"
            onPress={() => router.push('/reports/requests')}
          />
          <ReportCategoryCard
            icon="receipt-outline"
            title="Transactions"
            description="Verified blockchain transaction history"
            onPress={() => router.push('/reports/transactions')}
          />

          <View style={{ height: 20 + insets.bottom }} />
        </ScrollView>
      )}

      {isDateSheetMounted ? (
        <ReportDateRangeSheet
          ref={dateSheetRef}
          initialIndex={0}
          preset={datePreset}
          customStartIso={customStartIso}
          customEndIso={customEndIso}
          onSelectPreset={(preset) => {
            setDatePreset(preset);
            dateSheetRef.current?.close();
          }}
          onApplyCustomRange={(startIso, endIso) => {
            setCustomRange(startIso, endIso);
            dateSheetRef.current?.close();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  trendRow: { flexDirection: 'row', alignItems: 'center' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  metricTile: { flexBasis: '47%', flexGrow: 1 },
});
