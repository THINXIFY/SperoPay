import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface SelectFieldProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  // True when `label` is standing in for a placeholder (nothing chosen
  // yet, e.g. "Select your country") rather than a real selected value --
  // renders muted instead of primary text, matching TextField's own
  // placeholder treatment. Defaults to false, so every existing call site
  // (which always has a real value, e.g. "USDC") renders unchanged.
  isPlaceholder?: boolean;
  // Overrides the row's accessibility label -- defaults to `label`, which
  // is wrong when `label` is itself a placeholder string doubling as
  // display text (e.g. "Select your country" reading oddly as the a11y
  // label instead of a plain "Select country" action name).
  accessibilityLabel?: string;
}

// A compact bordered selector row — leading icon-chip (optional), label,
// trailing chevron. Used where a field represents a single current choice
// that opens a picker (bottom sheet, etc.) rather than a generic text input.
export function SelectField({ icon, label, onPress, isPlaceholder, accessibilityLabel }: SelectFieldProps) {
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
      accessibilityLabel={accessibilityLabel ?? label}
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
      <Text
        style={[typography.bodyMedium, { color: isPlaceholder ? colors.textMuted : colors.textPrimary, flex: 1 }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
      <Ionicons name="chevron-down" size={18} color={colors.textMuted} style={{ marginLeft: spacing.xs }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: 52 },
  iconChip: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
