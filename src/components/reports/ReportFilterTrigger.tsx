import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

interface ReportFilterTriggerProps {
  activeCount: number;
  onPress: () => void;
}

// The compact "Filters" / "Filters · 2" control (spec: never a long chip
// row) -- the active count is the only visible signal that something is
// narrowed, matching how the rest of the app keeps filter state legible
// without permanently-visible chips.
export function ReportFilterTrigger({ activeCount, onPress }: ReportFilterTriggerProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const isActive = activeCount > 0;
  const label = isActive ? `Filters · ${activeCount}` : 'Filters';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Open filters`}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: isActive ? colors.softMint : colors.surface,
          borderColor: isActive ? colors.softMint : colors.border,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name="options-outline" size={14} color={isActive ? colors.softMintText : colors.textPrimary} />
      <Text style={[typography.bodySmall, { color: isActive ? colors.softMintText : colors.textPrimary, marginLeft: spacing.xs }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1 },
});
