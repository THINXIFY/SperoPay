import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useTheme } from '../theme/useTheme';

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

export function BottomNavigation({ state, navigation }: BottomTabBarProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((route) => route.name !== 'request-action');
  const leftRoutes = visibleRoutes.slice(0, 2);
  const rightRoutes = visibleRoutes.slice(2);

  function renderTab(route: (typeof state.routes)[number]) {
    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const icon = ICONS[route.name] ?? 'ellipse-outline';

    return (
      <Pressable
        key={route.key}
        onPress={() => navigation.navigate(route.name)}
        style={styles.tab}
        accessibilityRole="button"
        accessibilityLabel={LABELS[route.name] ?? route.name}
      >
        <Ionicons name={icon} size={22} color={isFocused ? colors.tabBarIconActive : colors.tabBarIcon} />
        <Text
          style={[
            typography.caption,
            { color: isFocused ? colors.tabBarIconActive : colors.tabBarIconMuted, marginTop: spacing.xs / 2 },
          ]}
        >
          {LABELS[route.name] ?? route.name}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.tabBarBackground, paddingBottom: insets.bottom || spacing.sm },
      ]}
    >
      {leftRoutes.map(renderTab)}

      <View style={styles.centerWrap}>
        <Pressable
          onPress={() => router.push('/request/amount')}
          style={[styles.centerButton, { backgroundColor: colors.primaryAction, borderRadius: radius.full }]}
          accessibilityRole="button"
          accessibilityLabel="Request payment"
        >
          <Ionicons name="add" size={26} color={colors.primaryActionText} />
        </Pressable>
      </View>

      {rightRoutes.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 10, paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  centerWrap: { flex: 1, alignItems: 'center' },
  centerButton: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: -24 },
});
