import React, { forwardRef, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { BottomSheetProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../../theme/useTheme';
import { AppBottomSheet } from '../AppBottomSheet';
import { TextField } from '../TextField';
import { SecondaryButton } from '../SecondaryButton';
import { PrimaryButton } from '../PrimaryButton';
import type { Customer } from '../../types';

export interface ReportsFilterValues {
  customerId: string | null;
  status: string;
  amountMin: number | null;
  amountMax: number | null;
}

interface ReportsFilterSheetProps extends Partial<Omit<BottomSheetProps, 'children'>> {
  customers: Customer[];
  statusOptions: { value: string; label: string }[];
  values: ReportsFilterValues;
  onApply: (values: ReportsFilterValues) => void;
  initialIndex?: number;
}

const SNAP_POINTS = ['75%', '92%'];
const DEFAULT_VALUES: ReportsFilterValues = { customerId: null, status: 'all', amountMin: null, amountMax: null };

function renderSelectRow(
  key: string,
  label: string,
  selected: boolean,
  onPress: () => void,
  colors: ReturnType<typeof useTheme>['colors'],
  spacing: ReturnType<typeof useTheme>['spacing'],
  radius: ReturnType<typeof useTheme>['radius'],
  typography: ReturnType<typeof useTheme>['typography']
) {
  return (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.row,
        {
          borderRadius: radius.md,
          paddingVertical: spacing.sm + spacing.xs / 2,
          paddingHorizontal: spacing.base,
          backgroundColor: selected ? colors.softMint : pressed ? colors.background : 'transparent',
          marginBottom: spacing.xs,
        },
      ]}
    >
      <Text style={[typography.body, { color: selected ? colors.softMintText : colors.textPrimary, flex: 1 }]} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.softMintText} /> : null}
    </Pressable>
  );
}

// Unlike RequestFilterSheet's instant-apply rows, this sheet holds a LOCAL
// draft and only commits it to the caller (and closes) when "Apply
// Filters" is pressed -- the spec explicitly asks for Reset/Apply footer
// buttons here, a deliberately different interaction from the rest of the
// app's filter sheets (see RequestFilterSheet's own comment on why IT
// doesn't have one) rather than an oversight.
export const ReportsFilterSheet = forwardRef<BottomSheet, ReportsFilterSheetProps>(
  ({ customers, statusOptions, values, onApply, initialIndex = -1, ...rest }, ref) => {
    const { colors, spacing, radius, typography } = useTheme();
    const [draft, setDraft] = useState<ReportsFilterValues>(values);
    const [minText, setMinText] = useState(values.amountMin !== null ? String(values.amountMin) : '');
    const [maxText, setMaxText] = useState(values.amountMax !== null ? String(values.amountMax) : '');

    // Re-sync the draft to whatever is currently applied every time the
    // sheet is opened fresh, so a cancelled edit from a previous visit
    // never lingers.
    useEffect(() => {
      setDraft(values);
      setMinText(values.amountMin !== null ? String(values.amountMin) : '');
      setMaxText(values.amountMax !== null ? String(values.amountMax) : '');
    }, [values]);

    function handleReset() {
      setDraft(DEFAULT_VALUES);
      setMinText('');
      setMaxText('');
    }

    function handleApply() {
      const min = minText.trim() === '' ? null : Number(minText);
      const max = maxText.trim() === '' ? null : Number(maxText);
      onApply({
        ...draft,
        amountMin: min !== null && Number.isFinite(min) ? min : null,
        amountMax: max !== null && Number.isFinite(max) ? max : null,
      });
    }

    const activeCount =
      (draft.customerId ? 1 : 0) + (draft.status !== 'all' ? 1 : 0) + (minText.trim() !== '' || maxText.trim() !== '' ? 1 : 0);

    return (
      <AppBottomSheet ref={ref} initialIndex={initialIndex} snapPoints={SNAP_POINTS} scrollable {...rest}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.lg }]}>Filters</Text>

        {statusOptions.length > 0 ? (
          <>
            <Text style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.6, marginBottom: spacing.sm }]}>
              STATUS
            </Text>
            {statusOptions.map((option) =>
              renderSelectRow(
                option.value,
                option.label,
                option.value === draft.status,
                () => setDraft((d) => ({ ...d, status: option.value })),
                colors,
                spacing,
                radius,
                typography
              )
            )}
          </>
        ) : null}

        <Text
          style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: spacing.sm }]}
        >
          AMOUNT RANGE (USDC)
        </Text>
        <View style={[styles.amountRow, { gap: spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <TextField label="Min" value={minText} onChangeText={setMinText} placeholder="0" keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Max" value={maxText} onChangeText={setMaxText} placeholder="No limit" keyboardType="decimal-pad" />
          </View>
        </View>

        <Text
          style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.6, marginTop: spacing.sm, marginBottom: spacing.sm }]}
        >
          CUSTOMER
        </Text>
        {renderSelectRow('all', 'All customers', draft.customerId === null, () => setDraft((d) => ({ ...d, customerId: null })), colors, spacing, radius, typography)}
        {customers.map((customer) =>
          renderSelectRow(
            customer.id,
            customer.name,
            draft.customerId === customer.id,
            () => setDraft((d) => ({ ...d, customerId: customer.id })),
            colors,
            spacing,
            radius,
            typography
          )
        )}

        <View style={[styles.footer, { gap: spacing.sm, marginTop: spacing.lg }]}>
          <View style={{ flex: 1 }}>
            <SecondaryButton label={activeCount > 0 ? `Reset (${activeCount})` : 'Reset'} onPress={handleReset} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Apply Filters" onPress={handleApply} />
          </View>
        </View>
      </AppBottomSheet>
    );
  }
);
ReportsFilterSheet.displayName = 'ReportsFilterSheet';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  amountRow: { flexDirection: 'row' },
  footer: { flexDirection: 'row' },
});
