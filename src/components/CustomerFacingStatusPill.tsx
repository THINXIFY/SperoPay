import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { deriveCustomerFacingStatus, type DeriveStatusParams } from '../utils/customerFacingStatus';

// Extracted from app/c/[token].tsx's original inline StatusPill/
// statusPillColors -- the invoice page needs the exact same customer-facing
// status pill (never a raw internal status string), so this is shared
// rather than a second, drifting copy.
function statusPillColors(tone: ReturnType<typeof deriveCustomerFacingStatus>['tone'], colors: ReturnType<typeof useTheme>['colors']) {
  switch (tone) {
    case 'success':
      return { bg: colors.softMint, text: colors.softMintText };
    case 'danger':
      return { bg: colors.softRed, text: colors.softRedText };
    case 'warning':
      return { bg: colors.softLavender, text: colors.softLavenderText };
    case 'info':
      return { bg: colors.softBlue, text: colors.softBlueText };
    default:
      return { bg: colors.background, text: colors.textMuted };
  }
}

export function CustomerFacingStatusPill(params: DeriveStatusParams) {
  const { colors, spacing, radius, typography } = useTheme();
  const derived = deriveCustomerFacingStatus(params);
  const tone = statusPillColors(derived.tone, colors);
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm }]}>
      <Text style={[typography.caption, { color: tone.text }]}>{derived.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingVertical: 3 },
});
