import { useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { EmptyState } from '../../src/components/EmptyState';
import { CustomerAvatar } from '../../src/components/CustomerAvatar';
import { ReportDateRangeTrigger } from '../../src/components/reports/ReportDateRangeTrigger';
import { ReportDateRangeSheet } from '../../src/components/reports/ReportDateRangeSheet';
import { ReportFilterTrigger } from '../../src/components/reports/ReportFilterTrigger';
import { ReportsFilterSheet, type ReportsFilterValues } from '../../src/components/reports/ReportsFilterSheet';
import { ReportSearchBar } from '../../src/components/reports/ReportSearchBar';
import { ExportSheet } from '../../src/components/reports/ExportSheet';
import { IconButton } from '../../src/components/IconButton';
import { CurrencyFilterChips } from '../../src/components/CurrencyFilterChips';
import { useReportsData } from '../../src/store/useReportsData';
import { useReportsFilterStore } from '../../src/store/reportsFilterStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useAuthStore } from '../../src/store/authStore';
import { getPaymentsReportRows, filterRowsByCustomer, filterRowsByAmountRange, type PaymentReportRow } from '../../src/utils/reportsCalculations';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { buildReportHtml } from '../../src/utils/pdfReportHtml';
import { buildPaymentsCsv } from '../../src/utils/csvExport';
import { shareReportPdf, shareReportCsv } from '../../src/utils/reportExport';
import { resolveDisplayName } from '../../src/utils/resolveDisplayName';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All payments' },
  { value: 'paid', label: 'Paid in full' },
  { value: 'partial', label: 'Partial contribution' },
];

function formatRowDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

export default function PaymentsReportScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    requests,
    customers,
    transactions,
    range,
    rangeLabel,
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
  const [statusFilter, setLocalStatusFilter] = useState<'all' | 'paid' | 'partial'>('all');

  const datePreset = useReportsFilterStore((state) => state.datePreset);
  const customStartIso = useReportsFilterStore((state) => state.customStartIso);
  const customEndIso = useReportsFilterStore((state) => state.customEndIso);
  const setDatePreset = useReportsFilterStore((state) => state.setDatePreset);
  const setCustomRange = useReportsFilterStore((state) => state.setCustomRange);
  const setCustomerId = useReportsFilterStore((state) => state.setCustomerId);
  const setAmountRange = useReportsFilterStore((state) => state.setAmountRange);

  const profile = useProfileStore((state) => state.profile);
  const userFullName = useAuthStore((state) => state.user?.fullName);

  const dateSheetRef = useRef<BottomSheet>(null);
  const filterSheetRef = useRef<BottomSheet>(null);
  const exportSheetRef = useRef<BottomSheet>(null);
  const [isDateSheetMounted, setIsDateSheetMounted] = useState(false);
  const [isFilterSheetMounted, setIsFilterSheetMounted] = useState(false);
  const [isExportSheetMounted, setIsExportSheetMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  const allRows = useMemo(() => getPaymentsReportRows(transactions, requests, customers, range), [transactions, requests, customers, range]);

  const rows = useMemo(() => {
    let result = filterRowsByCustomer(allRows, customerId);
    result = filterRowsByAmountRange(result, amountMin, amountMax);
    if (statusFilter === 'paid') result = result.filter((r) => !r.isPartialContribution);
    if (statusFilter === 'partial') result = result.filter((r) => r.isPartialContribution);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (r) => r.customerName.toLowerCase().includes(q) || r.paymentCode.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [allRows, customerId, amountMin, amountMax, statusFilter, query]);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const businessName = profile?.businessName?.trim() || resolveDisplayName(profile?.displayName, userFullName, undefined) || 'Spero';

  async function handleExportPdf() {
    setExporting('pdf');
    try {
      const html = buildReportHtml({
        businessName,
        businessLogoUrl: profile?.businessLogoUri,
        reportTitle: 'Payments Report',
        dateRangeLabel: rangeLabel,
        generatedAtLabel: formatRowDate(new Date().toISOString()),
        metrics: [
          { label: 'Total Received', value: `${formatCurrency(total)} ${selectedCurrency}` },
          { label: 'Payments', value: String(rows.length) },
        ],
        tableHeaders: ['Customer', 'Request', 'Amount', 'Date', 'Status'],
        tableRows: rows.map((r) => [r.customerName, r.paymentCode, `${formatCurrency(r.amount)} ${selectedCurrency}`, formatRowDate(r.paidAt), r.isPartialContribution ? 'Partial' : 'Paid']),
        emptyMessage: 'No payments in this period.',
      });
      await shareReportPdf(html, 'spero-payments-report');
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
      const csv = buildPaymentsCsv(rows);
      await shareReportCsv(csv, 'spero-payments-report');
      exportSheetRef.current?.close();
    } catch {
      Alert.alert('Export Failed', "We couldn't generate the CSV. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  function renderRow({ item }: { item: PaymentReportRow }) {
    const customer = customers.find((c) => c.id === item.customerId);
    return (
      <Pressable
        onPress={() => router.push(`/(app)/requests/${item.requestId}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.customerName}, ${formatCurrency(item.amount)}, ${item.isPartialContribution ? 'partial' : 'paid'}`}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: colors.border, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <CustomerAvatar name={item.customerName} color={customer?.avatarColor ?? 'blue'} avatarUrl={customer?.avatarUrl} imageType={customer?.imageType} size={40} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.customerName}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
            {item.description || item.paymentCode} · {formatRowDate(item.paidAt)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{formatCurrency(item.amount)}</Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: item.isPartialContribution ? `${colors.pending}26` : `${colors.success}26`,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                marginTop: spacing.xs / 2,
              },
            ]}
          >
            <Text style={[typography.caption, { color: item.isPartialContribution ? colors.pending : colors.success }]}>
              {item.isPartialContribution ? 'Partial' : 'Paid'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <AppHeader title="Payments" onBackPress={() => router.back()} rightIcon="download-outline" onRightPress={() => (isExportSheetMounted ? exportSheetRef.current?.expand() : setIsExportSheetMounted(true))} rightAccessibilityLabel="Export" />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.transactionId}
        renderItem={renderRow}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 20 + insets.bottom }}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.base }}>
            <View style={[styles.toolbarRow, { gap: spacing.sm, marginBottom: spacing.base }]}>
              <ReportDateRangeTrigger label={rangeLabel} onPress={() => (isDateSheetMounted ? dateSheetRef.current?.expand() : setIsDateSheetMounted(true))} />
              <ReportFilterTrigger
                activeCount={sharedFilterCount + (statusFilter !== 'all' ? 1 : 0)}
                onPress={() => (isFilterSheetMounted ? filterSheetRef.current?.expand() : setIsFilterSheetMounted(true))}
              />
            </View>
            <View style={{ marginBottom: spacing.base }}>
              <CurrencyFilterChips currencies={currencies} selected={selectedCurrency} onSelect={setCurrency} />
            </View>
            <ReportSearchBar value={query} onChangeText={setQuery} placeholder="Search customer or request" />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.base }]}>
              {rows.length} {rows.length === 1 ? 'payment' : 'payments'} · {formatCurrency(total)} {selectedCurrency}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="cash-outline"
            title={allRows.length === 0 ? 'No payments in this period' : 'No matching payments'}
            description={allRows.length === 0 ? 'Verified payments you receive will show up here.' : 'Try a different search term or clear your filters.'}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
      />

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

      {isFilterSheetMounted ? (
        <ReportsFilterSheet
          ref={filterSheetRef}
          initialIndex={0}
          customers={customers}
          statusOptions={STATUS_OPTIONS}
          values={{ customerId, status: statusFilter, amountMin, amountMax }}
          onApply={(values: ReportsFilterValues) => {
            setCustomerId(values.customerId);
            setLocalStatusFilter(values.status as typeof statusFilter);
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
  toolbarRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  statusPill: { alignSelf: 'flex-end' },
});
