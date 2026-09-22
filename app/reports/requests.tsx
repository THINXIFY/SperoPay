import { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { ReportDateRangeTrigger } from '../../src/components/reports/ReportDateRangeTrigger';
import { ReportDateRangeSheet } from '../../src/components/reports/ReportDateRangeSheet';
import { ExportSheet } from '../../src/components/reports/ExportSheet';
import { CurrencyFilterChips } from '../../src/components/CurrencyFilterChips';
import { useReportsData } from '../../src/store/useReportsData';
import { useReportsFilterStore } from '../../src/store/reportsFilterStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useAuthStore } from '../../src/store/authStore';
import { getRequestsReportBreakdown, type RequestsReportBreakdown } from '../../src/utils/reportsCalculations';
import { buildReportHtml } from '../../src/utils/pdfReportHtml';
import { buildRequestsCsv } from '../../src/utils/csvExport';
import { shareReportPdf, shareReportCsv } from '../../src/utils/reportExport';
import { resolveDisplayName } from '../../src/utils/resolveDisplayName';

function formatGeneratedAt(): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
}

const ROWS: { key: keyof RequestsReportBreakdown; label: string; colorKey: 'success' | 'pending' | 'expired' | 'error' }[] = [
  { key: 'paid', label: 'Paid', colorKey: 'success' },
  { key: 'pending', label: 'Pending', colorKey: 'pending' },
  { key: 'partiallyPaid', label: 'Partially Paid', colorKey: 'pending' },
  { key: 'expired', label: 'Expired', colorKey: 'expired' },
  { key: 'cancelled', label: 'Cancelled', colorKey: 'error' },
];

export default function RequestsReportScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { requests, transactions, range, rangeLabel, now, refresh, isRefreshing, currencies, selectedCurrency, setCurrency } = useReportsData();

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

  const breakdown = useMemo(() => getRequestsReportBreakdown(requests, transactions, range, now), [requests, transactions, range, now]);
  const businessName = profile?.businessName?.trim() || resolveDisplayName(profile?.displayName, userFullName, undefined) || 'Spero';

  async function handleExportPdf() {
    setExporting('pdf');
    try {
      const html = buildReportHtml({
        businessName,
        businessLogoUrl: profile?.businessLogoUri,
        reportTitle: 'Requests Report',
        dateRangeLabel: rangeLabel,
        generatedAtLabel: formatGeneratedAt(),
        metrics: [{ label: 'Created', value: String(breakdown.created) }, { label: 'Paid', value: String(breakdown.paid) }],
        tableHeaders: ['Category', 'Count'],
        tableRows: [
          ['Created', breakdown.created],
          ['Paid', breakdown.paid],
          ['Pending', breakdown.pending],
          ['Partially Paid', breakdown.partiallyPaid],
          ['Expired', breakdown.expired],
          ['Cancelled', breakdown.cancelled],
        ],
        emptyMessage: 'No requests in this period.',
      });
      await shareReportPdf(html, 'spero-requests-report');
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
      const csv = buildRequestsCsv(breakdown);
      await shareReportCsv(csv, 'spero-requests-report');
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
        title="Requests"
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

        <ThemeAwareCard variant="hero" style={{ padding: spacing.xl, marginTop: spacing.lg, alignItems: 'center' }}>
          <Text style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted }]}>Requests Created</Text>
          <Text style={[typography.display, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>{breakdown.created}</Text>
        </ThemeAwareCard>

        {/* Compact horizontal status summary -- a proportional bar, not a
            chart, matching the spec's "avoid oversized charts" guidance. */}
        {breakdown.created > 0 ? (
          <View style={[styles.bar, { borderRadius: radius.full, marginTop: spacing.xl, backgroundColor: colors.border }]}>
            {ROWS.filter((r) => breakdown[r.key] > 0).map((r) => (
              <View key={r.key} style={{ flex: breakdown[r.key], backgroundColor: colors[r.colorKey] }} />
            ))}
          </View>
        ) : null}

        <ThemeAwareCard style={{ marginTop: spacing.lg }}>
          {ROWS.map((r, index) => (
            <View
              key={r.key}
              style={[styles.row, { paddingVertical: spacing.sm, borderBottomWidth: index === ROWS.length - 1 ? 0 : 1, borderBottomColor: colors.border }]}
            >
              <View style={[styles.dot, { backgroundColor: colors[r.colorKey], borderRadius: radius.full }]} />
              <Text style={[typography.body, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>{r.label}</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{breakdown[r.key]}</Text>
            </View>
          ))}
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
  bar: { flexDirection: 'row', height: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8 },
});
