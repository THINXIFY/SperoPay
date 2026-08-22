import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { ThemeAwareCard } from './ThemeAwareCard';

interface SettingsGroupProps {
  children: React.ReactNode;
}

// Wraps a set of SettingsRows in one grouped card with a hairline divider
// between rows (not after the last) — the shared "cohesive premium list"
// container so screens don't hand-roll card + divider logic per section.
export function SettingsGroup({ children }: SettingsGroupProps) {
  const { colors } = useTheme();
  const rows = React.Children.toArray(children);

  return (
    <ThemeAwareCard style={{ paddingVertical: 0 }}>
      {rows.map((child, index) => (
        <React.Fragment key={index}>
          {child}
          {index < rows.length - 1 ? (
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }} />
          ) : null}
        </React.Fragment>
      ))}
    </ThemeAwareCard>
  );
}
