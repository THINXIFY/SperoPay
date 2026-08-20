import { useRef } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useThemeStore } from '../../../src/store/themeStore';
import { useWalletStore } from '../../../src/store/walletStore';
import type { ThemePreference } from '../../../src/types';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { paddingVertical: spacing.md }]}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.md }]}>{label}</Text>
      {value ? (
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginRight: spacing.xs }]}>{value}</Text>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.xs }]}>
      {children}
    </Text>
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function ProfileScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const wallet = useWalletStore((state) => state.wallet);
  const appearanceSheetRef = useRef<BottomSheet>(null);
  const currencySheetRef = useRef<BottomSheet>(null);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.xl }]}>Profile</Text>

        <ThemeAwareCard>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: colors.softMint, borderRadius: radius.full }]}>
              <Text style={[typography.h3, { color: colors.softMintText }]}>
                {(profile.displayName || 'F').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ marginLeft: spacing.md }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {profile.displayName || 'Your Name'}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{user?.email}</Text>
            </View>
          </View>
        </ThemeAwareCard>

        <SectionLabel>ACCOUNT</SectionLabel>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="person-outline" label="Edit Profile" onPress={() => router.push('/(app)/profile/edit')} />
          <Row icon="briefcase-outline" label="Business Profile" onPress={() => router.push('/(app)/profile/business')} />
          <Row icon="lock-closed-outline" label="Security" onPress={() => router.push('/(app)/profile/security')} />
        </ThemeAwareCard>

        <SectionLabel>PAYMENTS</SectionLabel>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row
            icon="wallet-outline"
            label="Receiving Wallet"
            value={wallet ? truncateAddress(wallet.address) : 'Not set'}
            onPress={() => router.push('/(app)/profile/wallet')}
          />
          <Row icon="options-outline" label="Payment Defaults" onPress={() => router.push('/(app)/profile/payment-defaults')} />
          <Row icon="copy-outline" label="Templates" onPress={() => router.push('/(app)/profile/templates')} />
        </ThemeAwareCard>

        <SectionLabel>PREFERENCES</SectionLabel>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="color-palette-outline" label="Appearance" value={themeLabel} onPress={() => appearanceSheetRef.current?.expand()} />
          <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/(app)/profile/notifications')} />
          <Row icon="cash-outline" label="Currency Display" value="USD" onPress={() => currencySheetRef.current?.expand()} />
        </ThemeAwareCard>

        <SectionLabel>SUPPORT</SectionLabel>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="help-circle-outline" label="Help & Support" onPress={() => router.push('/(app)/profile/help')} />
          <Row icon="information-circle-outline" label="About SperoPay" onPress={() => router.push('/(app)/profile/about')} />
        </ThemeAwareCard>

        <SectionLabel>SESSION</SectionLabel>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="log-out-outline" label="Sign Out" onPress={handleSignOut} />
        </ThemeAwareCard>
      </ScrollView>

      <AppBottomSheet ref={appearanceSheetRef}>
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

      <AppBottomSheet ref={currencySheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Currency Display</Text>
        <View style={[styles.row, { paddingVertical: spacing.md }]}>
          <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>USD — US Dollar</Text>
          <Ionicons name="checkmark" size={20} color={colors.primaryAction} />
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          More display currencies are coming in a future update.
        </Text>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
