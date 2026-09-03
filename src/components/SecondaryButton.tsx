import React from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface SecondaryButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function SecondaryButton({ label, onPress, disabled, loading, icon }: SecondaryButtonProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: spacing.base,
          opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <View style={styles.content}>
          <Text style={[typography.button, { color: colors.textPrimary }]}>{label}</Text>
          {icon ? (
            <Ionicons name={icon} size={18} color={colors.textPrimary} style={{ marginLeft: spacing.xs }} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
