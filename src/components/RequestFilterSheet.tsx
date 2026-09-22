import React, { forwardRef } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { BottomSheetProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/useTheme';
import { AppBottomSheet } from './AppBottomSheet';
import type { PaymentRequestStatus } from '../types';

// 'archived' is not a PaymentRequestStatus -- it's an independent
// archived_at timestamp, orthogonal to status (an archived request keeps
// whatever status it already had -- spec: "status does not change").
// Handled the same derived way filtering already treats a value that
// isn't a literal status column match (see requests/index.tsx).
export type RequestFilter = 'all' | PaymentRequestStatus | 'archived';
export type RequestSort = 'newest' | 'oldest' | 'highest' | 'lowest';

export const FILTER_OPTIONS: { value: RequestFilter; label: string }[] = [
  { value: 'all', label: 'All requests' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirming', label: 'Confirming' },
  { value: 'paid', label: 'Paid' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
];

export const SORT_OPTIONS: { value: RequestSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Highest amount' },
  { value: 'lowest', label: 'Lowest amount' },
];

interface RequestFilterSheetProps extends Partial<Omit<BottomSheetProps, 'children'>> {
  filter: RequestFilter;
  sort: RequestSort;
  onSelectFilter: (value: RequestFilter) => void;
  onSelectSort: (value: RequestSort) => void;
  initialIndex?: number;
}

const SNAP_POINTS = ['62%', '90%'];

// Replaces the Requests list's old always-visible chip row: one compact
// bottom sheet holds both status filter and sort order, following the exact
// selection-row pattern already established by ReminderPresetSheet (softMint
// highlight + trailing checkmark on the selected row). Selecting a row does
// NOT auto-close the sheet -- unlike ReminderPresetSheet's single-choice
// picker, a merchant may want to set both filter and sort in one visit, so
// closing is left to the existing app-wide convention (backdrop tap /
// swipe-down), same as AppActionSheet.
export const RequestFilterSheet = forwardRef<BottomSheet, RequestFilterSheetProps>(
  ({ filter, sort, onSelectFilter, onSelectSort, initialIndex = -1, ...rest }, ref) => {
    const { colors, spacing, radius, typography } = useTheme();

    function renderRow(value: string, label: string, selected: boolean, onPress: () => void) {
      return (
        <Pressable
          key={value}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
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
            {label}
          </Text>
          {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.softMintText} /> : null}
        </Pressable>
      );
    }

    return (
      <AppBottomSheet ref={ref} initialIndex={initialIndex} snapPoints={SNAP_POINTS} scrollable {...rest}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.lg }]}>Filter &amp; sort</Text>

        <Text style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.6, marginBottom: spacing.sm }]}>
          STATUS
        </Text>
        {FILTER_OPTIONS.map((option) =>
          renderRow(option.value, option.label, option.value === filter, () => onSelectFilter(option.value))
        )}

        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: spacing.sm },
          ]}
        >
          SORT BY
        </Text>
        {SORT_OPTIONS.map((option) =>
          renderRow(option.value, option.label, option.value === sort, () => onSelectSort(option.value))
        )}
      </AppBottomSheet>
    );
  }
);
RequestFilterSheet.displayName = 'RequestFilterSheet';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
