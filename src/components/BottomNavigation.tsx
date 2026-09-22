import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useTheme } from '../theme/useTheme';
import { useRequestDraftStore } from '../store/requestDraftStore';
import { usePaymentDefaultsStore } from '../store/paymentDefaultsStore';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  requests: 'document-text-outline',
  customers: 'people-outline',
  profile: 'person-outline',
};

const LABELS: Record<string, string> = {
  home: 'Home',
  requests: 'Requests',
  customers: 'Customers',
  profile: 'Profile',
};

// requests/customers/profile are each backed by a nested Stack (index +
// detail/sub screens, see their own _layout.tsx) -- a plain
// navigation.navigate(route.name) resumes whatever screen was LAST active
// in that stack, not its list/index screen. That's the exact bug this
// fixes: open a request's detail, tap the Requests tab again, and a plain
// navigate() lands back on that same detail screen instead of the list.
// Explicitly targeting the nested `index` screen makes the tab button
// always return to the list, popping any detail screen above it (a stack
// navigator pops to an already-mounted route when navigated to directly)
// -- the behavior every tab button is expected to have. `home` has no
// nested stack (it's a single screen), so it's left out and still
// resolved with a plain navigate.
const TAB_ROUTES_WITH_INDEX = new Set(['requests', 'customers', 'profile']);

// The bar's own content height, above the device safe-area inset: container paddingTop
// (spacing.sm = 8) + a tab's paddingVertical (6+6=12) + icon (22) + label gap
// (spacing.xs / 2 = 2) + caption lineHeight (16) + dot gap (3) + dot (4) + container
// paddingBottom (spacing.xs = 4) = 71. Screens using a plain ScrollView (which, unlike
// this floating custom bar, isn't auto-avoided by the layout) combine this with their
// own useSafeAreaInsets().bottom to size clearance for the last item instead of guessing.
export const TAB_BAR_CONTENT_HEIGHT = 71;

// Explicit, always-square dimensions — the radius is derived from the size so the
// button can never render as anything but a perfect circle, on any screen or platform.
const CENTER_BUTTON_SIZE = 50;
const CENTER_BUTTON_RADIUS = CENTER_BUTTON_SIZE / 2;
const CENTER_BUTTON_ICON_SIZE = 24;
// How far the button's top edge pokes above the bar — a modest overlap, not a half-height float.
const CENTER_BUTTON_OVERLAP = 56;

export function BottomNavigation({ state, navigation }: BottomTabBarProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  const defaultCurrency = usePaymentDefaultsStore((state) => state.defaultCurrency);

  const visibleRoutes = state.routes.filter((route) => route.name !== 'request-action');
  const leftRoutes = visibleRoutes.slice(0, 2);
  const rightRoutes = visibleRoutes.slice(2);

  function renderTab(route: (typeof state.routes)[number]) {
    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const icon = ICONS[route.name] ?? 'ellipse-outline';
    const label = LABELS[route.name] ?? route.name;
    const tintColor = isFocused ? colors.tabBarIconActive : colors.tabBarIcon;

    return (
      <Pressable
        key={route.key}
        onPress={() =>
          TAB_ROUTES_WITH_INDEX.has(route.name)
            ? navigation.navigate(route.name, { screen: 'index' })
            : navigation.navigate(route.name)
        }
        style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
      >
        <Ionicons name={icon} size={22} color={tintColor} />
        <Text
          style={[
            typography.caption,
            { color: isFocused ? colors.tabBarIconActive : colors.tabBarIconMuted, marginTop: spacing.xs / 2 },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <View
          style={[styles.activeDot, { backgroundColor: isFocused ? colors.tabBarIconActive : 'transparent' }]}
        />
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.tabBarBackground,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xs,
          paddingHorizontal: spacing.sm,
        },
      ]}
    >
      {leftRoutes.map(renderTab)}

      {/* A normal flex item, same as every tab — this is what guarantees it sits exactly
          centered between Requests and Customers, not floating off in some other position.
          Only marginTop (not width/height/radius) is used to raise it slightly above the row. */}
      <View style={styles.centerWrap}>
        <Pressable
          onPress={() => {
            startFresh(defaultExpiryOption, defaultCurrency);
            router.push('/request/amount');
          }}
          style={({ pressed }) => [
            styles.centerButton,
            {
              backgroundColor: colors.primaryAction,
              marginTop: -CENTER_BUTTON_OVERLAP,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Request payment"
        >
          <Ionicons name="add" size={CENTER_BUTTON_ICON_SIZE} color={colors.primaryActionText} />
        </Pressable>
      </View>

      {rightRoutes.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  activeDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 },
  // Same flex:1 share as each tab — this is the whole trick: it's the 3rd of 5 equal
  // columns, so it's mathematically centered between the two left and two right tabs.
  centerWrap: { flex: 1, alignItems: 'center' },
  // Shape only — always a fixed square with radius derived from that same size.
  centerButton: {
    width: CENTER_BUTTON_SIZE,
    height: CENTER_BUTTON_SIZE,
    borderRadius: CENTER_BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
