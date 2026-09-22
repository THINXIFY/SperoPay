import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { openTransactionInExplorer } from '../utils/openInExplorer';

interface ExplorerLinkRowProps {
  /** The verified transaction's on-chain signature -- omit/pass undefined to render nothing (never shown before a real signature exists). */
  txHash?: string | null;
  /** Omits the bottom hairline -- pass when this is the last row in its card. */
  last?: boolean;
}

// "View on Solana Explorer" -- one shared row used everywhere a verified
// transaction is shown (Request Detail, Receipt, Reports' Transactions
// row). The actual URL-building + open-with-fallback logic lives in
// openInExplorer.ts (independently unit tested); this component is purely
// the visual row.
export function ExplorerLinkRow({ txHash, last }: ExplorerLinkRowProps) {
  const { colors, spacing, typography } = useTheme();
  if (!txHash) return null;

  return (
    <Pressable
      onPress={() => openTransactionInExplorer(txHash)}
      accessibilityRole="button"
      accessibilityLabel="View on Solana Explorer"
      style={({ pressed }) => [
        styles.row,
        { paddingVertical: spacing.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[typography.bodySmall, { color: colors.textPrimary, flex: 1 }]}>View on Solana Explorer</Text>
      <View style={styles.iconRow}>
        <Ionicons name="open-outline" size={15} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconRow: { flexDirection: 'row', alignItems: 'center' },
});
