import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { TextField } from './TextField';
import { getPasswordStrength } from '../utils/passwordStrength';
import type { TextInputProps } from 'react-native';

interface PasswordFieldProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label: string;
  error?: string;
  // Shows the weak/good/strong meter below the field -- for a password
  // being CHOSEN (sign-up, reset), never for one being entered to sign in
  // (a strength opinion on an existing password is just noise there).
  showStrength?: boolean;
}

const STRENGTH_COPY: Record<'weak' | 'good' | 'strong', string> = {
  weak: 'Weak',
  good: 'Good',
  strong: 'Strong',
};

export function PasswordField({ label, error, showStrength, value, ...inputProps }: PasswordFieldProps) {
  const { colors, spacing, typography } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const strength = showStrength && value ? getPasswordStrength(value) : null;
  const strengthColor = strength === 'strong' ? colors.success : strength === 'good' ? colors.pending : colors.error;

  return (
    <View>
      <TextField
        {...inputProps}
        value={value}
        label={label}
        error={error}
        secureTextEntry={!isVisible}
        autoCapitalize="none"
        autoCorrect={false}
        rightElement={
          <Pressable
            onPress={() => setIsVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={isVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        }
      />
      {strength ? (
        // TextField already carries its own marginBottom (spacing.base)
        // below the input -- this sits directly after that as a plain
        // sibling, so the gap stays correct regardless of TextField's own
        // spacing ever changing, rather than fighting it with a negative
        // margin.
        <View style={[styles.strengthRow, { marginTop: spacing.xs, marginBottom: spacing.base }]}>
          <View style={[styles.strengthTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.strengthFill,
                {
                  backgroundColor: strengthColor,
                  width: strength === 'weak' ? '33%' : strength === 'good' ? '66%' : '100%',
                },
              ]}
            />
          </View>
          <Text style={[typography.caption, { color: strengthColor, marginLeft: spacing.sm }]}>
            {STRENGTH_COPY[strength]}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strengthRow: { flexDirection: 'row', alignItems: 'center' },
  strengthTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  strengthFill: { height: 4, borderRadius: 2 },
});
