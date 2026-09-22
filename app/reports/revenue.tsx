import { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { StatTile } from '../../src/components/StatTile';
import { RevenueTrendChart } from '../../src/components/RevenueTrendChart';
import { ReportDateRangeTrigger } from '../../src/components/reports/ReportDateRangeTrigger';
import { ReportDateRangeSheet } from '../../src/components/reports/ReportDateRangeSheet';
import { ExportSheet } from '../../src/components/reports/ExportSheet';
import { CurrencyFilterChips } from '../../src/components/CurrencyFilterChips';
import { useReportsData } from '../../src/store/useReportsData';
import { useReportsFilterStore } from '../../src/store/reportsFilterStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useAuthStore } from '../../src/store/authStore';
import { getReportsSummary, getRevenueSeries } from '../../src/utils/reportsCalculations';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { buildReportHtml } from '../../src/utils/pdfReportHtml';
import { buildCsv } from '../../src/utils/csvExport';
import { shareReportPdf, shareReportCsv } from '../../src/utils/reportExport';
import { resolveDisplayName } from '../../src/utils/resolveDisplayName';

function formatGeneratedAt(): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
}

export default function RevenueReportScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { requests, transactions, range, previousRange, rangeLabel, now, refresh, isRefreshing, currencies, selectedCurrency, setCurrency } =
    useReportsData();

  const datePreset = useReportsFilterStore((state) => state.datePreset);
  const customStartIso = useReportsFilterStore((state) => state.customStartIso);
  const customEndIso = useReportsFilterStore((state) => state.customEndIso);
  const setDatePreset = useReportsFilterStore((state) => state.setDatePreset);
  const setCustomRange = useReportsFilterStore((state) => state.setCustomRange);

  const profile = useProfileStore((state) => state.profile);
  const userFullName = useAuthStore((state) => state.user?.fullName);

  const dateSheetRef = useRef<BottomSheet>(null);
  const exportSheetRef = useRef<BottomSheet>(null);
  const [isDateSheetMounted, setIsDateSheetMounted] = useState(false);
  const [isExportSheetMounted, setIsExportSheetMounted] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  const summary = useMemo(() => getReportsSummary(transactions, requests, range, previousRange, now), [transactions, requests, range, previousRange, now]);
  const series = useMemo(() => getRevenueSeries(transactions, range), [transactions, range]);
  const businessName = profile?.businessName?.trim() || resolveDisplayName(profile?.displayName, userFullName, undefined) || 'Spero';

  async function handleExportPdf() {
    setExporting('pdf');
    try {
      const html = buildReportHtml({
        businessName,
        businessLogoUrl: profile?.businessLogoUri,
        reportTitle: 'Revenue Report',
        dateRangeLabel: rangeLabel,
        generatedAtLabel: formatGeneratedAt(),
        metrics: [
          { label: 'Total Revenue', value: `${formatCurrency(summary.totalReceived)} ${selectedCurrency}` },
          { label: 'Payments', value: String(summary.paymentsCount) },
          { label: 'Average Payment', value: `${formatCurrency(summary.averagePayment)} ${selectedCurrency}` },
        ],
        tableHeaders: ['Period', `Revenue (${selectedCurrency})`],
        tableRows: series.map((p) => [p.label, formatCurrency(p.value)]),
        emptyMessage: 'No revenue in this period.',
      });
      await shareReportPdf(html, 'spero-revenue-report');
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
      const csv = buildCsv(['Period', `Revenue (${selectedCurrency})`], series.map((p) => [p.label, p.value]));
      await shareReportCsv(csv, 'spero-revenue-report');
      exportSheetRef.current?.close();
    } catch {
      Alert.alert('Export Failed', "We couldn't generate the CSV. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <AppHeader
        title="Revenue"
        onBackPress={() => router.back()}
        rightIcon="download-outline"
        onRightPress={() => (isExportSheetMounted ? exportSheetRef.current?.expand() : setIsExportSheetMounted(true))}
        rightAccessibilityLabel="Export"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 20 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        <ReportDateRangeTrigger label={rangeLabel} onPress={() => (isDateSheetMounted ? dateSheetRef.current?.expand() : setIsDateSheetMounted(true))} />

        <View style={{ marginTop: spacing.md }}>
          <CurrencyFilterChips currencies={currencies} selected={selectedCurrency} onSelect={setCurrency} />
        </View>

        <ThemeAwareCard variant="hero" style={{ padding: spacing.xl, marginTop: spacing.lg }}>
          <Text style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted }]}>Total Revenue</Text>
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
                style={[typography.bodySmall, { color: summary.changePercent >= 0 ? colors.success : colors.error, marginLeft: spacing.xs / 2 }]}
              >
                {Math.abs(summary.changePercent).toFixed(1)}% vs previous period
              </Text>
            </View>
          ) : null}
        </ThemeAwareCard>

        <View style={[styles.metricsRow, { marginTop: spacing.lg, gap: spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <StatTile label="Payments" value={String(summary.paymentsCount)} />
          </View>
          <View style={{ flex: 1 }}>
            <StatTile label="Avg. Payment" value={`${formatCurrency(summary.averagePayment)} ${selectedCurrency}`} />
          </View>
        </View>

        <ThemeAwareCard style={{ marginTop: spacing.xl, paddingBottom: spacing.sm }}>
          <RevenueTrendChart points={series} />
        </ThemeAwareCard>
      </ScrollView>

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

      {isExportSheetMounted ? (
        <ExportSheet ref={exportSheetRef} initialIndex={0} onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} exporting={exporting} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  trendRow: { flexDirection: 'row', alignItems: 'center' },
  metricsRow: { flexDirection: 'row' },
});
