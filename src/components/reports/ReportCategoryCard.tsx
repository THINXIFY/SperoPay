import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

interface ReportCategoryCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}

// One row per report category on Reports Home -- deliberately text-forward
// (icon chip + title + one-line description + chevron) rather than a big
// tile, so six of these read as a calm, scannable list instead of a
// cluttered dashboard of six equal-weight cards (spec: avoid giant cards).
export function ReportCategoryCard({ icon, title, description, onPress }: ReportCategoryCardProps) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.base,
          marginBottom: spacing.sm,
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.iconChip,
          { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryActionSoft, marginRight: spacing.md },
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.textPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
          {description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  iconChip: { alignItems: 'center', justifyContent: 'center' },
});
