import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

interface ReportDateRangeTriggerProps {
  label: string;
  onPress: () => void;
}

// The compact "This Month ▾" control every Reports screen shows instead of
// a long row of range chips (spec: "Do not display all ranges as a long
// chip row") -- opens ReportDateRangeSheet on tap.
export function ReportDateRangeTrigger({ label, onPress }: ReportDateRangeTriggerProps) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Date range: ${label}. Change date range`}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color={colors.textMuted} style={{ marginLeft: spacing.xs / 2 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1 },
});
