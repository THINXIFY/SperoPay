import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface SelectFieldProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

// A compact bordered selector row — leading icon-chip (optional), label,
// trailing chevron. Used where a field represents a single current choice
// that opens a picker (bottom sheet, etc.) rather than a generic text input.
export function SelectField({ icon, label, onPress }: SelectFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.md,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? (
        <View
          style={[
            styles.iconChip,
            { backgroundColor: colors.softMint, borderRadius: radius.full, marginRight: spacing.sm },
          ]}
        >
          <Ionicons name={icon} size={14} color={colors.softMintText} />
        </View>
      ) : null}
      <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: 52 },
  iconChip: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
