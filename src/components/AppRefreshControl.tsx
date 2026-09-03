import React from 'react';
import { RefreshControl, RefreshControlProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface AppRefreshControlProps extends Pick<RefreshControlProps, 'refreshing' | 'onRefresh'> {}

// Standardizes the pull-to-refresh spinner's theming everywhere it's used.
// RefreshControl needs BOTH `tintColor` (iOS's spinner color) and `colors`
// (the Android Material spinner's color, ignored on iOS) -- a screen that
// only set tintColor (the pattern this replaces) got an un-themed default
// gray/blue spinner on Android. `progressBackgroundColor` gives that same
// Android spinner a themed disc behind it instead of the OS default.
export function AppRefreshControl({ refreshing, onRefresh }: AppRefreshControlProps) {
  const { colors } = useTheme();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primaryAction}
      colors={[colors.primaryAction]}
      progressBackgroundColor={colors.surface}
    />
  );
}
