import React, { forwardRef } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { BottomSheetProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/useTheme';
import { AppBottomSheet } from './AppBottomSheet';

export type RecurringPlanFilter = 'all' | 'active' | 'paused' | 'completed';

export const RECURRING_PLAN_FILTER_OPTIONS: { value: RecurringPlanFilter; label: string }[] = [
  { value: 'all', label: 'All plans' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

interface RecurringPlanFilterSheetProps extends Partial<Omit<BottomSheetProps, 'children'>> {
  value: RecurringPlanFilter;
  onSelect: (value: RecurringPlanFilter) => void;
  initialIndex?: number;
}

const SNAP_POINTS = ['45%'];

// Mirrors RequestFilterSheet's exact selection-row pattern (softMint
// highlight + trailing checkmark) -- one compact bottom sheet instead of a
// row of filter chips, same reasoning as that screen's own redesign.
export const RecurringPlanFilterSheet = forwardRef<BottomSheet, RecurringPlanFilterSheetProps>(
  ({ value, onSelect, initialIndex = -1, ...rest }, ref) => {
    const { colors, spacing, radius, typography } = useTheme();

    return (
      <AppBottomSheet ref={ref} initialIndex={initialIndex} snapPoints={SNAP_POINTS} {...rest}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Filter plans</Text>
        {RECURRING_PLAN_FILTER_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
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
      </AppBottomSheet>
    );
  }
);
RecurringPlanFilterSheet.displayName = 'RecurringPlanFilterSheet';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
