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
//
// SettingsRow's own pressed-state highlight has no horizontal padding of
// its own, relying on this card's horizontal inset (ThemeAwareCard's base
// `padding: spacing.base`, i.e. 16) to keep the highlight's square corners
// clear of the card's rounded ones. That only works because spacing.base
// (16) and the card's own borderRadius (radius.lg, also 16) happen to be
// equal — not a designed invariant. If either constant changes on its own,
// re-check that the highlight still doesn't poke past the card's corners.
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
