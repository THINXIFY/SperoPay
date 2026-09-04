import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  // An icon/button rendered inside the field, right-aligned (e.g. a
  // password show/hide toggle) -- optional, every existing call site
  // omits it and renders exactly as before.
  rightElement?: React.ReactNode;
}

export function TextField({
  label,
  error,
  style,
  onFocus,
  onBlur,
  accessibilityLabel,
  rightElement,
  ...inputProps
}: TextFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={{ marginBottom: spacing.base }}>
      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
        {label}
      </Text>
      <View style={styles.inputWrap}>
        <TextInput
          {...inputProps}
          accessibilityLabel={accessibilityLabel ?? label}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          style={[
            typography.body,
            styles.input,
            {
              flex: 1,
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderColor: error ? colors.error : isFocused ? colors.primaryAction : colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.base,
              paddingRight: rightElement ? spacing.xxl : spacing.base,
            },
            style,
          ]}
        />
        {rightElement ? <View style={[styles.rightElement, { right: spacing.xs }]}>{rightElement}</View> : null}
      </View>
      {error ? (
        <Text style={[typography.caption, { color: colors.error, marginTop: spacing.xs }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { height: 52, borderWidth: 1 },
  inputWrap: { justifyContent: 'center' },
  rightElement: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
