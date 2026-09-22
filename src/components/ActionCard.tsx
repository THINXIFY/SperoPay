import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

const ICON_CHIP_SIZE = 36;

// A compact action-row button -- icon chip inline with its label, trailing
// chevron for tap affordance. Used where a plain SecondaryButton reads as
// too generic for a document-style screen (Request Detail's Invoice/Receipt
// actions). Reuses SettingsRow's icon-chip convention (36px, radius.md,
// primaryActionSoft tint, dark glyph) so it reads as the same branded-chip
// language used elsewhere in the app, and borrows ThemeAwareCard's shadow so
// it sits at the same visual weight as the cards around it.
export function ActionCard({ icon, label, onPress }: ActionCardProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.card,
        styles.shadow,
        {
          backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.iconChip,
          { width: ICON_CHIP_SIZE, height: ICON_CHIP_SIZE, borderRadius: radius.md, backgroundColor: colors.primaryActionSoft },
        ]}
      >
        <Ionicons name={icon} size={17} color={colors.textPrimary} />
      </View>
      <Text
        style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  iconChip: { alignItems: 'center', justifyContent: 'center' },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
});
