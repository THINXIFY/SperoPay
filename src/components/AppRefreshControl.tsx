import React from 'react';
import { RefreshControl, RefreshControlProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface AppRefreshControlProps extends Pick<RefreshControlProps, 'refreshing' | 'onRefresh'> {
  // ScrollView/FlatList's `refreshControl` prop is not rendered like a
  // normal child -- on Android specifically, the scroll view's own
  // internals clone whatever element is passed here and inject the actual
  // scrollable content into it AS children (Android's pull-to-refresh is a
  // SwipeRefreshLayout that must be the real native PARENT of the scroll
  // content, not a sibling). RN's own RefreshControl.android.js renders
  // `this.props.children` for exactly this reason. A wrapper component that
  // doesn't accept/forward `children` silently drops whatever the scroll
  // view tried to inject -- every screen using it renders blank on Android
  // (iOS is unaffected; its ScrollView wires refreshControl differently and
  // never injects children into it, so this prop is a harmless no-op there).
  children?: React.ReactNode;
}

// Standardizes the pull-to-refresh spinner's theming everywhere it's used.
// RefreshControl needs BOTH `tintColor` (iOS's spinner color) and `colors`
// (the Android Material spinner's color, ignored on iOS) -- a screen that
// only set tintColor (the pattern this replaces) got an un-themed default
// gray/blue spinner on Android. `progressBackgroundColor` gives that same
// Android spinner a themed disc behind it instead of the OS default.
export function AppRefreshControl({ refreshing, onRefresh, children }: AppRefreshControlProps) {
  const { colors } = useTheme();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primaryAction}
      colors={[colors.primaryAction]}
      progressBackgroundColor={colors.surface}
    >
      {children}
    </RefreshControl>
  );
}
