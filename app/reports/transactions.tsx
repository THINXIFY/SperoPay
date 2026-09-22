import { useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { EmptyState } from '../../src/components/EmptyState';
import { ReportDateRangeTrigger } from '../../src/components/reports/ReportDateRangeTrigger';
import { ReportDateRangeSheet } from '../../src/components/reports/ReportDateRangeSheet';
import { ReportFilterTrigger } from '../../src/components/reports/ReportFilterTrigger';
import { ReportsFilterSheet, type ReportsFilterValues } from '../../src/components/reports/ReportsFilterSheet';
import { ReportSearchBar } from '../../src/components/reports/ReportSearchBar';
import { ExportSheet } from '../../src/components/reports/ExportSheet';
import { CurrencyFilterChips } from '../../src/components/CurrencyFilterChips';
import { useReportsData } from '../../src/store/useReportsData';
import { useReportsFilterStore } from '../../src/store/reportsFilterStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useAuthStore } from '../../src/store/authStore';
import { getTransactionsReportRows, filterRowsByCustomer, filterRowsByAmountRange, type TransactionReportRow } from '../../src/utils/reportsCalculations';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { truncateHash } from '../../src/utils/truncateHash';
import { openTransactionInExplorer } from '../../src/utils/openInExplorer';
import { buildReportHtml } from '../../src/utils/pdfReportHtml';
import { buildTransactionsCsv } from '../../src/utils/csvExport';
import { shareReportPdf, shareReportCsv } from '../../src/utils/reportExport';
import { resolveDisplayName } from '../../src/utils/resolveDisplayName';

const NO_STATUS_OPTIONS: { value: string; label: string }[] = [];

function formatRowDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

export default function TransactionsReportScreen() {
  const { colors, spacing, typography } = useTheme();
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
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const allRows = useMemo(() => getTransactionsReportRows(transactions, requests, customers, range), [transactions, requests, customers, range]);
  const rows = useMemo(() => {
    let result = filterRowsByCustomer(allRows, customerId);
    result = filterRowsByAmountRange(result, amountMin, amountMax);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((r) => r.customerName.toLowerCase().includes(q) || r.paymentCode.toLowerCase().includes(q) || r.txHash.toLowerCase().includes(q));
    }
    return result;
  }, [allRows, customerId, amountMin, amountMax, query]);

  const businessName = profile?.businessName?.trim() || resolveDisplayName(profile?.displayName, userFullName, undefined) || 'Spero';

  async function handleCopyHash(txHash: string, id: string) {
    await Clipboard.setStringAsync(txHash);
    setCopiedTxId(id);
    setTimeout(() => setCopiedTxId((current) => (current === id ? null : current)), 2000);
  }

  async function handleExportPdf() {
    setExporting('pdf');
    try {
      const html = buildReportHtml({
        businessName,
        businessLogoUrl: profile?.businessLogoUri,
        reportTitle: 'Transactions Report',
        dateRangeLabel: rangeLabel,
        generatedAtLabel: formatRowDate(new Date().toISOString()),
        metrics: [{ label: 'Transactions', value: String(rows.length) }, { label: 'Total', value: `${formatCurrency(rows.reduce((sum, r) => sum + r.amount, 0))} ${selectedCurrency}` }],
        tableHeaders: ['Date', 'Customer', 'Request', 'Amount', 'Asset', 'Network', 'Signature'],
        tableRows: rows.map((r) => [formatRowDate(r.paidAt), r.customerName, r.paymentCode, formatCurrency(r.amount), r.currency, r.network, r.txHash]),
        emptyMessage: 'No transactions in this period.',
      });
      await shareReportPdf(html, 'spero-transactions-report');
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
      const csv = buildTransactionsCsv(rows);
      await shareReportCsv(csv, 'spero-transactions-report');
      exportSheetRef.current?.close();
    } catch {
      Alert.alert('Export Failed', "We couldn't generate the CSV. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  function renderRow({ item }: { item: TransactionReportRow }) {
    return (
      <Pressable
        onPress={() => router.push(`/(app)/requests/${item.requestId}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.customerName}, ${formatCurrency(item.amount)}, ${formatRowDate(item.paidAt)}`}
        style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.customerName}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
            {item.paymentCode} · {formatRowDate(item.paidAt)} · {item.network}
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleCopyHash(item.txHash, item.transactionId);
            }}
            hitSlop={6}
            style={styles.hashRow}
            accessibilityRole="button"
            accessibilityLabel="Copy transaction signature"
          >
            <Ionicons name={copiedTxId === item.transactionId ? 'checkmark' : 'copy-outline'} size={12} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.xs / 2 }]} numberOfLines={1}>
              {copiedTxId === item.transactionId ? 'Copied' : truncateHash(item.txHash)}
            </Text>
          </Pressable>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{formatCurrency(item.amount)}</Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              openTransactionInExplorer(item.txHash);
            }}
            hitSlop={8}
            style={{ marginTop: spacing.xs / 2 }}
            accessibilityRole="button"
            accessibilityLabel="View on Solana Explorer"
          >
            <Ionicons name="open-outline" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <AppHeader
        title="Transactions"
        onBackPress={() => router.back()}
        rightIcon="download-outline"
        onRightPress={() => (isExportSheetMounted ? exportSheetRef.current?.expand() : setIsExportSheetMounted(true))}
        rightAccessibilityLabel="Export"
      />

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
              <ReportFilterTrigger activeCount={sharedFilterCount} onPress={() => (isFilterSheetMounted ? filterSheetRef.current?.expand() : setIsFilterSheetMounted(true))} />
            </View>
            <View style={{ marginBottom: spacing.base }}>
              <CurrencyFilterChips currencies={currencies} selected={selectedCurrency} onSelect={setCurrency} />
            </View>
            <ReportSearchBar value={query} onChangeText={setQuery} placeholder="Search customer, request, or signature" />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.base }]}>
              {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={allRows.length === 0 ? 'No transactions in this period' : 'No matching transactions'}
            description={allRows.length === 0 ? 'Verified blockchain transactions will show up here.' : 'Try a different search term or clear your filters.'}
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
          statusOptions={NO_STATUS_OPTIONS}
          values={{ customerId, status: 'all', amountMin, amountMax }}
          onApply={(values: ReportsFilterValues) => {
            setCustomerId(values.customerId);
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
  toolbarRow: { flexDirection: 'row', alignItems: 'center' },
  hashRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-start' },
});
