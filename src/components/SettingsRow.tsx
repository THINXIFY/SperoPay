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

const ICON_COLUMN_WIDTH = 32;

export function SettingsRow({ icon, label, value, onPress, destructive }: SettingsRowProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const iconColor = destructive ? colors.error : colors.textSecondary;
  const labelColor = destructive ? colors.error : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: 56,
          backgroundColor: pressed ? colors.background : 'transparent',
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
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
            borderRadius: radius.full,
            backgroundColor: destructive ? colors.softRed : colors.background,
            // colors.background and the card's own colors.surface differ by
            // only a hair in both themes (by design -- background is
            // meant to read as "barely off the card"), so the neutral
            // chip needs a hairline border to stay visible as a distinct
            // shape -- same fix home.tsx's emptyIconWrap already uses for
            // the identical background-on-surface situation. Not needed
            // for the destructive variant, whose softRed tint has its own
            // real contrast, but applied uniformly for one consistent look.
            borderWidth: 1,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name={icon} size={16} color={iconColor} />
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
