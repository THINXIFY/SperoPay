import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}

const ICON_COLUMN_WIDTH = 36;

export function SettingsRow({ icon, label, value, onPress, destructive }: SettingsRowProps) {
  const { colors, spacing, radius, typography } = useTheme();
  // The lime tint carries the "branded" signal entirely via the chip's
  // background -- lime is a bright, light-luminance color, so lime-on-
  // lime-tint (the same trick StatusBadge uses for darker semantic colors)
  // would be genuinely poor contrast here. The glyph itself stays a plain
  // dark/neutral tone for real legibility.
  const iconColor = destructive ? colors.error : colors.textPrimary;
  const labelColor = destructive ? colors.error : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: 60,
          backgroundColor: pressed ? colors.background : 'transparent',
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <View
        style={[
          styles.iconColumn,
          {
            width: ICON_COLUMN_WIDTH,
            height: ICON_COLUMN_WIDTH,
            borderRadius: radius.md,
            // A single restrained lime tint for every non-destructive row
            // (not one color per category -- Spero's one signature accent,
            // used the same way StatusBadge already tints colored text on
            // a same-color soft background) makes the icon column read as
            // a deliberate, branded chip at a glance, not a bare glyph.
            backgroundColor: destructive ? colors.softRed : colors.primaryActionSoft,
          },
        ]}
      >
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text
        style={[typography.body, { color: labelColor, flex: 1, marginLeft: spacing.md }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Text>
      {value ? (
        <Text
          style={[typography.bodySmall, { color: colors.textMuted, marginLeft: spacing.sm, marginRight: spacing.xs }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {value}
        </Text>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconColumn: { alignItems: 'center', justifyContent: 'center' },
});
