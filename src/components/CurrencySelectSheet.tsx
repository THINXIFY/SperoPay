import React, { forwardRef } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { BottomSheetProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/useTheme';
import { AppBottomSheet } from './AppBottomSheet';
import { SUPPORTED_ASSETS, ASSET_REGISTRY, type AssetSymbol } from '../config/assets';

interface CurrencySelectSheetProps extends Partial<Omit<BottomSheetProps, 'children'>> {
  value: AssetSymbol;
  onSelect: (asset: AssetSymbol) => void;
  initialIndex?: number;
}

const SNAP_POINTS = ['40%'];

// Phase 7 -- the one currency picker used everywhere a merchant chooses
// USDC vs EURC (Smart Request, Business Settings' default, Templates,
// Recurring Plans): a single visual treatment so "USDC" always looks and
// behaves the same regardless of which screen it's picked from, and the
// option list is always driven by the registry (src/config/assets.ts) --
// no screen hardcodes its own two-item list. Deliberately just a symbol +
// full name + network, no logo art/price/market data (spec section 19).
export const CurrencySelectSheet = forwardRef<BottomSheet, CurrencySelectSheetProps>(
  ({ value, onSelect, initialIndex = -1, ...rest }, ref) => {
    const { colors, spacing, radius, typography } = useTheme();

    return (
      <AppBottomSheet ref={ref} initialIndex={initialIndex} snapPoints={SNAP_POINTS} {...rest}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Select currency</Text>
        {SUPPORTED_ASSETS.map((asset) => {
          const config = ASSET_REGISTRY[asset];
          const selected = asset === value;
          return (
            <Pressable
              key={asset}
              onPress={() => onSelect(asset)}
              accessibilityRole="button"
              accessibilityLabel={`${config.symbol}, ${config.name}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.row,
                {
                  borderRadius: radius.md,
                  padding: spacing.base,
                  backgroundColor: selected ? colors.softMint : pressed ? colors.background : 'transparent',
                  marginBottom: spacing.xs,
                },
              ]}
            >
              <View
                style={[
                  styles.symbolChip,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.full },
                ]}
              >
                <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '600' }]}>
                  {config.symbol.slice(0, 1)}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{config.symbol}</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                  {config.name} · {config.network}
                </Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.softMintText} /> : null}
            </Pressable>
          );
        })}
      </AppBottomSheet>
    );
  }
);
CurrencySelectSheet.displayName = 'CurrencySelectSheet';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  symbolChip: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
