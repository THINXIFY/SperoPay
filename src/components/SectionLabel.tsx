import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function SectionLabel({ children }: { children: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
      {children}
    </Text>
  );
}
