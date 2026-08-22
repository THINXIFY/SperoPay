import React from 'react';
import { View, Text, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface StatTileProps {
  label: string;
  value: string;
  style?: StyleProp<ViewStyle>;
}

// A compact fintech stat tile: hairline border only, no shadow, small
// footprint — for rows of 2-3 metrics where ThemeAwareCard's padding/shadow
// reads as too heavy (e.g. Customer Detail's Total Received/Payments/
// Outstanding row).
export function StatTile({ label, value, style }: StatTileProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View
      style={[
        styles.tile,
        { borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm },
        style,
      ]}
    >
      <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: 1 },
});
