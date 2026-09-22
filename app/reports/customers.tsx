import { useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { EmptyState } from '../../src/components/EmptyState';
import { CustomerAvatar } from '../../src/components/CustomerAvatar';
import { ReportDateRangeTrigger } from '../../src/components/reports/ReportDateRangeTrigger';
import { ReportDateRangeSheet } from '../../src/components/reports/ReportDateRangeSheet';
import { ReportSearchBar } from '../../src/components/reports/ReportSearchBar';
import { ExportSheet } from '../../src/components/reports/ExportSheet';
import { CurrencyFilterChips } from '../../src/components/CurrencyFilterChips';
import { useReportsData } from '../../src/store/useReportsData';
import { useReportsFilterStore } from '../../src/store/reportsFilterStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useAuthStore } from '../../src/store/authStore';
import { getCustomerReportRows, type CustomerReportRow, type CustomerReportSort } from '../../src/utils/reportsCalculations';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatRelativeTime } from '../../src/utils/formatRelativeTime';
import { buildReportHtml } from '../../src/utils/pdfReportHtml';
import { buildCustomersCsv } from '../../src/utils/csvExport';
import { shareReportPdf, shareReportCsv } from '../../src/utils/reportExport';
import { resolveDisplayName } from '../../src/utils/resolveDisplayName';

const SORT_OPTIONS: { value: CustomerReportSort; label: string }[] = [
  { value: 'revenue', label: 'Highest Revenue' },
  { value: 'payments', label: 'Most Payments' },
  { value: 'outstanding', label: 'Highest Outstanding' },
  { value: 'recent', label: 'Recent Activity' },
];

function formatGeneratedAt(): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
}

export default function CustomersReportScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { customers, transactions, requests, range, rangeLabel, refresh, isRefreshing, currencies, selectedCurrency, setCurrency } = useReportsData();

  const datePreset = useReportsFilterStore((state) => state.datePreset);
  const customStartIso = useReportsFilterStore((state) => state.customStartIso);
  const customEndIso = useReportsFilterStore((state) => state.customEndIso);
  const setDatePreset = useReportsFilterStore((state) => state.setDatePreset);
  const setCustomRange = useReportsFilterStore((state) => state.setCustomRange);

  const profile = useProfileStore((state) => state.profile);
  const userFullName = useAuthStore((state) => state.user?.fullName);

  const dateSheetRef = useRef<BottomSheet>(null);
  const sortSheetRef = useRef<BottomSheet>(null);
  const exportSheetRef = useRef<BottomSheet>(null);
  const [isDateSheetMounted, setIsDateSheetMounted] = useState(false);
  const [isSortSheetMounted, setIsSortSheetMounted] = useState(false);
  const [isExportSheetMounted, setIsExportSheetMounted] = useState(false);
  const [sortBy, setSortBy] = useState<CustomerReportSort>('revenue');
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  const allRows = useMemo(() => getCustomerReportRows(customers, transactions, requests, range, sortBy), [customers, transactions, requests, range, sortBy]);
  const rows = useMemo(() => {
    if (!query.trim()) return allRows;
    const q = query.trim().toLowerCase();
    return allRows.filter((r) => r.customerName.toLowerCase().includes(q));
  }, [allRows, query]);

  const businessName = profile?.businessName?.trim() || resolveDisplayName(profile?.displayName, userFullName, undefined) || 'Spero';
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Highest Revenue';

  async function handleExportPdf() {
    setExporting('pdf');
    try {
      const html = buildReportHtml({
        businessName,
        businessLogoUrl: profile?.businessLogoUri,
        reportTitle: 'Customer Report',
        dateRangeLabel: rangeLabel,
        generatedAtLabel: formatGeneratedAt(),
        metrics: [{ label: 'Customers', value: String(rows.length) }, { label: 'Sorted By', value: sortLabel }],
        tableHeaders: ['Customer', 'Total Received', 'Outstanding', 'Asset', 'Payments', 'Last Payment'],
        tableRows: rows.map((r) => [r.customerName, formatCurrency(r.totalReceived), formatCurrency(r.outstanding), selectedCurrency, String(r.paymentCount), r.lastPaymentAt ? formatGeneratedAtFrom(r.lastPaymentAt) : '—']),
        emptyMessage: 'No customer activity yet.',
      });
      await shareReportPdf(html, 'spero-customers-report');
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
      const csv = buildCustomersCsv(rows, selectedCurrency);
      await shareReportCsv(csv, 'spero-customers-report');
      exportSheetRef.current?.close();
    } catch {
      Alert.alert('Export Failed', "We couldn't generate the CSV. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  function renderRow({ item }: { item: CustomerReportRow }) {
    return (
      <Pressable
        onPress={() => router.push(`/(app)/customers/${item.customerId}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.customerName}, ${formatCurrency(item.totalReceived)} received`}
        style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 }]}
      >
        <CustomerAvatar name={item.customerName} color={item.avatarColor} avatarUrl={item.avatarUrl} imageType={item.imageType} size={40} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.customerName}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
            {item.paymentCount} {item.paymentCount === 1 ? 'payment' : 'payments'}
            {item.lastPaymentAt ? ` · Last ${formatRelativeTime(item.lastPaymentAt)}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{formatCurrency(item.totalReceived)}</Text>
          {item.outstanding > 0 ? (
            <Text style={[typography.caption, { color: colors.pending, marginTop: spacing.xs / 2 }]}>{formatCurrency(item.outstanding)} due</Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <AppHeader
        title="Customers"
        onBackPress={() => router.back()}
        rightIcon="download-outline"
        onRightPress={() => (isExportSheetMounted ? exportSheetRef.current?.expand() : setIsExportSheetMounted(true))}
        rightAccessibilityLabel="Export"
      />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.customerId}
        renderItem={renderRow}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 20 + insets.bottom }}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.base }}>
            <View style={[styles.toolbarRow, { gap: spacing.sm, marginBottom: spacing.base }]}>
              <ReportDateRangeTrigger label={rangeLabel} onPress={() => (isDateSheetMounted ? dateSheetRef.current?.expand() : setIsDateSheetMounted(true))} />
              <Pressable
                onPress={() => (isSortSheetMounted ? sortSheetRef.current?.expand() : setIsSortSheetMounted(true))}
                accessibilityRole="button"
                accessibilityLabel={`Sort: ${sortLabel}. Change sort`}
                style={({ pressed }) => [styles.sortPill, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="swap-vertical-outline" size={14} color={colors.textPrimary} />
                <Text style={[typography.bodySmall, { color: colors.textPrimary, marginLeft: spacing.xs / 2 }]} numberOfLines={1}>
                  {sortLabel}
                </Text>
              </Pressable>
            </View>
            <View style={{ marginBottom: spacing.base }}>
              <CurrencyFilterChips currencies={currencies} selected={selectedCurrency} onSelect={setCurrency} />
            </View>
            <ReportSearchBar value={query} onChangeText={setQuery} placeholder="Search customer" />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={allRows.length === 0 ? 'No customer activity yet' : 'No matching customers'}
            description={allRows.length === 0 ? 'Customer performance appears here once requests are sent.' : 'Try a different search term.'}
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

      {isSortSheetMounted ? (
        <AppBottomSheet ref={sortSheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Sort by</Text>
          {SORT_OPTIONS.map((option) => {
            const isActive = option.value === sortBy;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setSortBy(option.value);
                  sortSheetRef.current?.close();
                }}
                style={[styles.sortRow, { paddingVertical: spacing.md }]}
              >
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
                {isActive ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
              </Pressable>
            );
          })}
        </AppBottomSheet>
      ) : null}

      {isExportSheetMounted ? (
        <ExportSheet ref={exportSheetRef} initialIndex={0} onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} exporting={exporting} />
      ) : null}
    </SafeAreaView>
  );
}

function formatGeneratedAtFrom(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  toolbarRow: { flexDirection: 'row', alignItems: 'center' },
  sortPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  sortRow: { flexDirection: 'row', alignItems: 'center' },
});
