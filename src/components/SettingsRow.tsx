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

const ICON_COLUMN_WIDTH = 24;

export function SettingsRow({ icon, label, value, onPress, destructive }: SettingsRowProps) {
  const { colors, spacing, typography } = useTheme();
  const iconColor = destructive ? colors.error : colors.textSecondary;
  const labelColor = destructive ? colors.error : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { minHeight: 48, opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <View style={[styles.iconColumn, { width: ICON_COLUMN_WIDTH }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[typography.body, { color: labelColor, flex: 1, marginLeft: spacing.md }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text
          style={[typography.bodySmall, { color: colors.textMuted, marginRight: spacing.xs }]}
          numberOfLines={1}
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
