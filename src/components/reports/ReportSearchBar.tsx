import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

interface ReportSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

// Same visual pattern as the Customers list's own search row (see
// app/(app)/customers/index.tsx) -- extracted here since Payments and
// Transactions reports both need it too, and a Reports-only home keeps it
// out of the general component folder for something this feature-specific.
export function ReportSearchBar({ value, onChangeText, placeholder }: ReportSearchBarProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: isFocused ? colors.textPrimary : colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <Ionicons name="search-outline" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1 },
});
