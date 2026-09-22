import React, { forwardRef, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { BottomSheetProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../../theme/useTheme';
import { AppBottomSheet } from '../AppBottomSheet';
import { TextField } from '../TextField';
import { PrimaryButton } from '../PrimaryButton';
import { REPORT_DATE_RANGE_OPTIONS, type ReportDateRangePreset } from '../../utils/reportDateRange';
import { parseDateOnlyInput, formatDateOnly } from '../../utils/parseDateOnly';

interface ReportDateRangeSheetProps extends Partial<Omit<BottomSheetProps, 'children'>> {
  preset: ReportDateRangePreset;
  customStartIso: string | null;
  customEndIso: string | null;
  onSelectPreset: (preset: ReportDateRangePreset) => void;
  onApplyCustomRange: (startIso: string, endIso: string) => void;
  initialIndex?: number;
}

const SNAP_POINTS = ['62%', '90%'];

// Same selection-row pattern as RequestFilterSheet (softMint highlight +
// trailing checkmark) -- picking a fixed preset applies and closes
// immediately (nothing else to configure), but 'custom' instead reveals two
// validated From/To fields and only applies once the merchant confirms
// them, since a bare "Custom Range" tap alone has no dates to act on yet.
export const ReportDateRangeSheet = forwardRef<BottomSheet, ReportDateRangeSheetProps>(
  ({ preset, customStartIso, customEndIso, onSelectPreset, onApplyCustomRange, initialIndex = -1, ...rest }, ref) => {
    const { colors, spacing, radius, typography } = useTheme();
    const [showCustom, setShowCustom] = useState(preset === 'custom');
    const [startText, setStartText] = useState(customStartIso ? formatDateOnly(new Date(customStartIso)) : '');
    const [endText, setEndText] = useState(customEndIso ? formatDateOnly(new Date(customEndIso)) : '');

    // Re-sync local text state whenever the sheet is reopened against a
    // possibly-different already-applied custom range, rather than
    // carrying over stale edits from a previous open/close cycle.
    useEffect(() => {
      setShowCustom(preset === 'custom');
      setStartText(customStartIso ? formatDateOnly(new Date(customStartIso)) : '');
      setEndText(customEndIso ? formatDateOnly(new Date(customEndIso)) : '');
    }, [preset, customStartIso, customEndIso]);

    const startDate = parseDateOnlyInput(startText);
    const endDate = parseDateOnlyInput(endText);
    const rangeError =
      startText && endText && startDate && endDate && startDate.getTime() > endDate.getTime()
        ? 'Start date must be before end date'
        : startText && !startDate
          ? 'Use YYYY-MM-DD'
          : endText && !endDate
            ? 'Use YYYY-MM-DD'
            : undefined;
    const canApplyCustom = Boolean(startDate && endDate && !rangeError);

    function handleApplyCustom() {
      if (!startDate || !endDate) return;
      // End is exclusive in ReportDateRange -- the merchant picks an
      // inclusive "To" day, so the actual applied end is the start of the
      // NEXT day, letting that whole day's activity count.
      const inclusiveEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1);
      onApplyCustomRange(startDate.toISOString(), inclusiveEnd.toISOString());
    }

    return (
      <AppBottomSheet ref={ref} initialIndex={initialIndex} snapPoints={SNAP_POINTS} scrollable {...rest}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.lg }]}>Date range</Text>

        {REPORT_DATE_RANGE_OPTIONS.map((option) => {
          const selected = option.value === preset;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                if (option.value === 'custom') {
                  setShowCustom(true);
                  return;
                }
                setShowCustom(false);
                onSelectPreset(option.value);
              }}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.row,
                {
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.base,
                  backgroundColor: selected ? colors.softMint : pressed ? colors.background : 'transparent',
                  marginBottom: spacing.xs,
                },
              ]}
            >
              <Text style={[typography.body, { color: selected ? colors.softMintText : colors.textPrimary, flex: 1 }]}>
                {option.label}
              </Text>
              {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.softMintText} /> : null}
            </Pressable>
          );
        })}

        {showCustom ? (
          <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TextField
              label="From (YYYY-MM-DD)"
              value={startText}
              onChangeText={setStartText}
              placeholder="2026-01-01"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />
            <TextField
              label="To (YYYY-MM-DD)"
              value={endText}
              onChangeText={setEndText}
              placeholder="2026-01-31"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              error={rangeError}
            />
            <PrimaryButton label="Apply Custom Range" onPress={handleApplyCustom} disabled={!canApplyCustom} />
          </View>
        ) : null}
      </AppBottomSheet>
    );
  }
);
ReportDateRangeSheet.displayName = 'ReportDateRangeSheet';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
