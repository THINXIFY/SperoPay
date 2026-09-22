import { useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { EmptyState } from '../../src/components/EmptyState';
import { StatTile } from '../../src/components/StatTile';
import { ReportFilterTrigger } from '../../src/components/reports/ReportFilterTrigger';
import { ReportsFilterSheet, type ReportsFilterValues } from '../../src/components/reports/ReportsFilterSheet';
import { ExportSheet } from '../../src/components/reports/ExportSheet';
import { CurrencyFilterChips } from '../../src/components/CurrencyFilterChips';
import { useReportsData } from '../../src/store/useReportsData';
import { useReportsFilterStore } from '../../src/store/reportsFilterStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useAuthStore } from '../../src/store/authStore';
import {
  getOutstandingSummary,
  getOutstandingReportRows,
  filterRowsByCustomer,
  filterRowsByAmountRange,
  type OutstandingReportRow,
} from '../../src/utils/reportsCalculations';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { buildReportHtml } from '../../src/utils/pdfReportHtml';
import { buildOutstandingCsv } from '../../src/utils/csvExport';
import { shareReportPdf, shareReportCsv } from '../../src/utils/reportExport';
import { resolveDisplayName } from '../../src/utils/resolveDisplayName';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All outstanding' },
  { value: 'pending', label: 'Pending' },
  { value: 'partiallyPaid', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
];

const BUCKET_LABEL: Record<OutstandingReportRow['bucket'], string> = {
  pending: 'Pending',
  partiallyPaid: 'Partially Paid',
  overdue: 'Overdue',
};

function formatGeneratedAt(): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
}

export default function OutstandingReportScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    requests,
    customers,
    transactions,
    now,
    refresh,
    isRefreshing,
    customerId,
    amountMin,
    amountMax,
    sharedFilterCount,
    currencies,
    selectedCurrency,
    setCurrency,
  } = useReportsData();

  const setCustomerId = useReportsFilterStore((state) => state.setCustomerId);
  const setAmountRange = useReportsFilterStore((state) => state.setAmountRange);
  const profile = useProfileStore((state) => state.profile);
  const userFullName = useAuthStore((state) => state.user?.fullName);

  const filterSheetRef = useRef<BottomSheet>(null);
  const exportSheetRef = useRef<BottomSheet>(null);
  const [isFilterSheetMounted, setIsFilterSheetMounted] = useState(false);
  const [isExportSheetMounted, setIsExportSheetMounted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | OutstandingReportRow['bucket']>('all');
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  // Outstanding is always a live, current snapshot -- not date-ranged (see
  // reportsCalculations.ts's own comment on why a balance owed 3 months ago
  // is still meaningfully "outstanding" today). No ReportDateRangeTrigger
  // on this screen -- showing one would imply this data respects the
  // global period, which it deliberately does not.
  const summary = useMemo(() => getOutstandingSummary(requests, transactions, now), [requests, transactions, now]);
  const allRows = useMemo(() => getOutstandingReportRows(requests, transactions, customers, now).map((r) => ({ ...r, amount: r.remainingAmount })), [requests, transactions, customers, now]);

  const rows = useMemo(() => {
    let result = filterRowsByCustomer(allRows, customerId);
    result = filterRowsByAmountRange(result, amountMin, amountMax);
    if (statusFilter !== 'all') result = result.filter((r) => r.bucket === statusFilter);
    return result;
  }, [allRows, customerId, amountMin, amountMax, statusFilter]);

  const businessName = profile?.businessName?.trim() || resolveDisplayName(profile?.displayName, userFullName, undefined) || 'Spero';

  async function handleExportPdf() {
    setExporting('pdf');
    try {
      const html = buildReportHtml({
        businessName,
        businessLogoUrl: profile?.businessLogoUri,
        reportTitle: 'Outstanding Report',
        dateRangeLabel: 'Current balances',
        generatedAtLabel: formatGeneratedAt(),
        metrics: [
          { label: 'Total Outstanding', value: `${formatCurrency(summary.totalOutstanding)} ${selectedCurrency}` },
          { label: 'Overdue', value: `${formatCurrency(summary.overdueAmount)} ${selectedCurrency}` },
          { label: 'Partially Paid', value: `${formatCurrency(summary.partiallyPaidAmount)} ${selectedCurrency}` },
        ],
        tableHeaders: ['Customer', 'Request', 'Original', 'Paid', 'Remaining', 'Asset', 'Status'],
        tableRows: rows.map((r) => [r.customerName, r.paymentCode, formatCurrency(r.originalAmount), formatCurrency(r.paidAmount), formatCurrency(r.remainingAmount), r.currency, BUCKET_LABEL[r.bucket]]),
        emptyMessage: 'Nothing outstanding right now.',
      });
      await shareReportPdf(html, 'spero-outstanding-report');
      exportSheetRef.current?.close();
    } catch {
      Alert.alert('Export Failed', "We couldn't generate the PDF. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportCsv() {
    setExporting('csv');
    try {
      const csv = buildOutstandingCsv(rows);
      await shareReportCsv(csv, 'spero-outstanding-report');
      exportSheetRef.current?.close();
    } catch {
      Alert.alert('Export Failed', "We couldn't generate the CSV. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  function renderRow({ item }: { item: OutstandingReportRow }) {
    const bucketColor = item.bucket === 'overdue' ? colors.error : item.bucket === 'partiallyPaid' ? colors.pending : colors.textMuted;
    return (
      <Pressable
        onPress={() => router.push(`/(app)/requests/${item.requestId}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.customerName}, ${formatCurrency(item.remainingAmount)} remaining, ${BUCKET_LABEL[item.bucket]}`}
        style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.customerName}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
            {item.paymentCode} · {formatCurrency(item.paidAmount)} of {formatCurrency(item.originalAmount)} paid
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{formatCurrency(item.remainingAmount)}</Text>
          <View style={[styles.statusPill, { backgroundColor: `${bucketColor}26`, borderRadius: radius.full, paddingHorizontal: spacing.sm, marginTop: spacing.xs / 2 }]}>
            <Text style={[typography.caption, { color: bucketColor }]}>{BUCKET_LABEL[item.bucket]}</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <AppHeader
        title="Outstanding"
        onBackPress={() => router.back()}
        rightIcon="download-outline"
        onRightPress={() => (isExportSheetMounted ? exportSheetRef.current?.expand() : setIsExportSheetMounted(true))}
        rightAccessibilityLabel="Export"
      />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.requestId}
        renderItem={renderRow}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 20 + insets.bottom }}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.base }}>
            <ReportFilterTrigger
              activeCount={sharedFilterCount + (statusFilter !== 'all' ? 1 : 0)}
              onPress={() => (isFilterSheetMounted ? filterSheetRef.current?.expand() : setIsFilterSheetMounted(true))}
            />
            <View style={{ marginTop: spacing.base }}>
              <CurrencyFilterChips currencies={currencies} selected={selectedCurrency} onSelect={setCurrency} />
            </View>
            <View style={[styles.metricsRow, { marginTop: spacing.base, gap: spacing.sm }]}>
              <StatTile label="Total Outstanding" value={`${formatCurrency(summary.totalOutstanding)} ${selectedCurrency}`} style={styles.metricTile} />
              <StatTile label="Overdue" value={`${formatCurrency(summary.overdueAmount)} ${selectedCurrency}`} style={styles.metricTile} />
              <StatTile label="Partially Paid" value={`${formatCurrency(summary.partiallyPaidAmount)} ${selectedCurrency}`} style={styles.metricTile} />
              <StatTile label="Pending" value={`${formatCurrency(summary.pendingAmount)} ${selectedCurrency}`} style={styles.metricTile} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="checkmark-done-outline"
            title={allRows.length === 0 ? "You're all caught up" : 'No matching balances'}
            description={allRows.length === 0 ? 'Nothing outstanding right now.' : 'Try clearing your filters.'}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
      />

      {isFilterSheetMounted ? (
        <ReportsFilterSheet
          ref={filterSheetRef}
          initialIndex={0}
          customers={customers}
          statusOptions={STATUS_OPTIONS}
          values={{ customerId, status: statusFilter, amountMin, amountMax }}
          onApply={(values: ReportsFilterValues) => {
            setCustomerId(values.customerId);
            setStatusFilter(values.status as typeof statusFilter);
            setAmountRange(values.amountMin, values.amountMax);
            filterSheetRef.current?.close();
          }}
        />
      ) : null}

      {isExportSheetMounted ? (
        <ExportSheet ref={exportSheetRef} initialIndex={0} onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} exporting={exporting} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  statusPill: { alignSelf: 'flex-end' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  metricTile: { flexBasis: '47%', flexGrow: 1 },
});
