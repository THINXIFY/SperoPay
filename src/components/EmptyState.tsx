import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  // Optional -- every existing call site omits these and renders exactly as
  // before. Only pass both together (a label with no handler, or vice
  // versa, doesn't render a button at all).
  actionLabel?: string;
  onActionPress?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onActionPress }: EmptyStateProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const showAction = Boolean(actionLabel && onActionPress);

  return (
    <View style={[styles.container, { padding: spacing.xxl }]}>
      <View
        style={[
          styles.iconRing,
          { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons name={icon} size={26} color={colors.textMuted} />
      </View>
      <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text
        style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}
      >
        {description}
      </Text>
      {showAction ? (
        <Pressable
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: colors.primaryAction,
              borderRadius: radius.full,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              marginTop: spacing.lg,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[typography.bodyMedium, { color: colors.primaryActionText }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  iconRing: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  actionButton: { alignItems: 'center', justifyContent: 'center' },
});
