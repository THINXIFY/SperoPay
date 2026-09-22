import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { AssetSymbol } from '../config/assets';

interface CurrencyFilterChipsProps {
  currencies: AssetSymbol[];
  selected: AssetSymbol;
  onSelect: (currency: AssetSymbol) => void;
}

// Phase 7 -- the "asset selector" option spec section 15 offers as an
// alternative to always-separated sections: a merchant using both USDC and
// EURC picks which one Reports/Analytics is currently showing, the same
// way they already pick a date range. Deliberately renders nothing at all
// when `currencies.length <= 1` (every existing USDC-only account) -- a
// second asset only becomes visible UI once a merchant's data actually has
// one.
export function CurrencyFilterChips({ currencies, selected, onSelect }: CurrencyFilterChipsProps) {
  const { colors, spacing, radius, typography } = useTheme();
  if (currencies.length <= 1) return null;

  return (
    <View style={styles.row}>
      {currencies.map((asset) => {
        const isSelected = asset === selected;
        return (
          <Pressable
            key={asset}
            onPress={() => onSelect(asset)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={asset}
            style={[
              styles.chip,
              {
                borderRadius: radius.full,
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.xs,
                marginRight: spacing.sm,
                backgroundColor: isSelected ? colors.softMint : 'transparent',
                borderColor: isSelected ? 'transparent' : colors.border,
                borderWidth: isSelected ? 0 : 1,
              },
            ]}
          >
            <Text style={[typography.bodySmall, { color: isSelected ? colors.softMintText : colors.textSecondary }]}>{asset}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: { alignItems: 'center', justifyContent: 'center' },
});
