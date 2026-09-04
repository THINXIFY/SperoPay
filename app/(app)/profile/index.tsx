import { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { SectionLabel } from '../../../src/components/SectionLabel';
import { SettingsGroup } from '../../../src/components/SettingsGroup';
import { SettingsRow } from '../../../src/components/SettingsRow';
import { AppRefreshControl } from '../../../src/components/AppRefreshControl';
import { TAB_BAR_CONTENT_HEIGHT } from '../../../src/components/BottomNavigation';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useThemeStore } from '../../../src/store/themeStore';
import { useWalletStore } from '../../../src/store/walletStore';
import { useRefreshProfileData } from '../../../src/store/useRefreshProfileData';
import { resolveDisplayName } from '../../../src/utils/resolveDisplayName';
import type { ThemePreference } from '../../../src/types';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function ProfileScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  // Narrowed to the two primitive fields actually used below -- see
  // home.tsx for why: the whole `user` object is rebuilt on every auth
  // event, including silent background token refreshes.
  const userFullName = useAuthStore((state) => state.user?.fullName);
  const userEmail = useAuthStore((state) => state.user?.email);
  const signOut = useAuthStore((state) => state.signOut);
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const wallet = useWalletStore((state) => state.wallet);
  const { refresh: refreshProfileData, isRefreshing } = useRefreshProfileData();
  const appearanceSheetRef = useRef<BottomSheet>(null);
  const currencySheetRef = useRef<BottomSheet>(null);

  // Neither sheet is rendered at all until first opened -- see
  // request/amount.tsx for why this is the correct fix: gorhom's imperative
  // .expand() silently no-ops if called before native layout resolves,
  // which an always-mounted sheet's first .expand() call can race.
  // AppBottomSheet's `initialIndex` prop is the layout-aware, declarative
  // alternative used on first mount below.
  const [isAppearanceSheetMounted, setIsAppearanceSheetMounted] = useState(false);
  const [isCurrencySheetMounted, setIsCurrencySheetMounted] = useState(false);

  function openAppearanceSheet() {
    if (isAppearanceSheetMounted) {
      appearanceSheetRef.current?.expand();
    } else {
      setIsAppearanceSheetMounted(true);
    }
  }

  function openCurrencySheet() {
    if (isCurrencySheetMounted) {
      currencySheetRef.current?.expand();
    } else {
      setIsCurrencySheetMounted(true);
    }
  }

  // Defense in depth for a reused/backgrounded screen instance whose sheet
  // was left open from an earlier visit -- this being a tab screen, it's
  // kept mounted across tab switches too.
  useFocusEffect(
    useCallback(() => {
      appearanceSheetRef.current?.forceClose();
      currencySheetRef.current?.forceClose();
    }, [])
  );

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(auth)/welcome');
          } catch {
            Alert.alert('Sign Out Failed', 'Something went wrong. Please try again.');
          }
        },
      },
    ]);
  }

  const themeLabel = THEME_OPTIONS.find((opt) => opt.value === (preference ?? 'light'))?.label ?? 'Light';
  const displayName = resolveDisplayName(profile?.displayName, userFullName, userEmail) || 'Your Name';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        // Horizontal/top only -- bottom clearance comes entirely from the
        // spacer View below (see its own comment). Using the `padding`
        // shorthand here too would apply spacing.xl to the bottom edge as
        // well, stacking with that spacer into ~32px more trailing
        // whitespace than home.tsx's own equivalent formula.
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refreshProfileData} />}
      >
        <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.md }]}>Profile</Text>

        <Pressable
          onPress={() => router.push('/(app)/profile/edit')}
          style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          accessibilityRole="button"
          accessibilityLabel={`${displayName}, ${userEmail}. View and edit profile`}
        >
          <ThemeAwareCard variant="hero" style={{ padding: spacing.xl, alignItems: 'center' }}>
            <UserAvatar name={displayName} avatarUri={profile?.avatarUri} borderStyle={profile?.avatarBorderStyle} size={72} />
            <Text
              style={[typography.h2, { color: colors.heroSurfaceText, marginTop: spacing.md, textAlign: 'center' }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted, marginTop: spacing.xs / 2 }]}
              numberOfLines={1}
            >
              {userEmail}
            </Text>
            <View
              style={[
                styles.accountPill,
                { backgroundColor: colors.primaryActionSoft, borderRadius: radius.full, paddingHorizontal: spacing.md, marginTop: spacing.md },
              ]}
            >
              <Ionicons name="shield-checkmark" size={12} color={colors.primaryAction} />
              <Text style={[typography.caption, { color: colors.primaryAction, marginLeft: spacing.xs }]}>Personal Account</Text>
            </View>
            <View
              style={[
                styles.editPill,
                {
                  backgroundColor: colors.heroSurfaceBorder,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  marginTop: spacing.lg,
                },
              ]}
            >
              <Ionicons name="create-outline" size={14} color={colors.heroSurfaceText} />
              <Text style={[typography.caption, { color: colors.heroSurfaceText, marginLeft: spacing.xs }]}>Edit Profile</Text>
            </View>
          </ThemeAwareCard>
        </Pressable>

        <SectionLabel>ACCOUNT</SectionLabel>
        <SettingsGroup>
          <SettingsRow icon="person-outline" label="Edit Profile" onPress={() => router.push('/(app)/profile/edit')} />
          <SettingsRow
            icon="briefcase-outline"
            label="Business Profile"
            onPress={() => router.push('/(app)/profile/business')}
          />
          <SettingsRow icon="lock-closed-outline" label="Security" onPress={() => router.push('/(app)/profile/security')} />
        </SettingsGroup>

        <SectionLabel>PAYMENTS</SectionLabel>
        <SettingsGroup>
          <SettingsRow
            icon="wallet-outline"
            label="Receiving Wallet"
            value={wallet ? truncateAddress(wallet.address) : 'Not set'}
            onPress={() => router.push('/(app)/profile/wallet')}
          />
          <SettingsRow
            icon="options-outline"
            label="Payment Defaults"
            onPress={() => router.push('/(app)/profile/payment-defaults')}
          />
          <SettingsRow icon="copy-outline" label="Templates" onPress={() => router.push('/(app)/profile/templates')} />
        </SettingsGroup>

        <SectionLabel>PREFERENCES</SectionLabel>
        <SettingsGroup>
          <SettingsRow
            icon="color-palette-outline"
            label="Appearance"
            value={themeLabel}
            onPress={openAppearanceSheet}
          />
          <SettingsRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push('/(app)/profile/notifications')}
          />
          <SettingsRow
            icon="cash-outline"
            label="Currency Display"
            value="USD"
            onPress={openCurrencySheet}
          />
        </SettingsGroup>

        <SectionLabel>SUPPORT</SectionLabel>
        <SettingsGroup>
          <SettingsRow icon="help-circle-outline" label="Help & Support" onPress={() => router.push('/(app)/profile/help')} />
          <SettingsRow
            icon="information-circle-outline"
            label="About SperoPay"
            onPress={() => router.push('/(app)/profile/about')}
          />
        </SettingsGroup>

        <SectionLabel>SESSION</SectionLabel>
        <SettingsGroup>
          <SettingsRow icon="log-out-outline" label="Sign Out" onPress={handleSignOut} destructive />
        </SettingsGroup>

        {/* A real, rendered spacer -- not just contentContainerStyle
            paddingBottom -- as the actual last child, so the space below
            Sign Out is guaranteed regardless of how the container's own
            padding resolves (see analytics.tsx for why padding alone isn't
            reliable here). Profile is a genuine tab screen (unlike
            Analytics), so its clearance needs TAB_BAR_CONTENT_HEIGHT in
            addition to the real device inset, matching home.tsx's own
            formula for the same reason. */}
        <View style={{ height: 20 + insets.bottom + TAB_BAR_CONTENT_HEIGHT }} />
      </ScrollView>

      {isAppearanceSheetMounted ? (
        <AppBottomSheet ref={appearanceSheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Appearance</Text>
          {THEME_OPTIONS.map((option) => {
            const isActive = (preference ?? 'light') === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setPreference(option.value);
                  appearanceSheetRef.current?.close();
                }}
                style={[styles.row, { paddingVertical: spacing.md }]}
              >
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
                {isActive ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
              </Pressable>
            );
          })}
        </AppBottomSheet>
      ) : null}

      {isCurrencySheetMounted ? (
        <AppBottomSheet ref={currencySheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Currency Display</Text>
          <View style={[styles.row, { paddingVertical: spacing.md }]}>
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>USD — US Dollar</Text>
            <Ionicons name="checkmark" size={20} color={colors.primaryAction} />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            More display currencies are coming in a future update.
          </Text>
        </AppBottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  accountPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  editPill: { flexDirection: 'row', alignItems: 'center' },
});
