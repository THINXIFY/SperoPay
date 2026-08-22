import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface SelectableCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function SelectableCard({ icon, label, selected, onPress }: SelectableCardProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: radius.lg,
          padding: spacing.base,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.primaryAction : colors.border,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: selected ? colors.primaryAction : colors.background, borderRadius: radius.full },
        ]}
      >
        <Ionicons name={icon} size={20} color={selected ? colors.primaryActionText : colors.textPrimary} />
      </View>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  iconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
