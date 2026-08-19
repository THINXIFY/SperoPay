import { useRef } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useThemeStore } from '../../../src/store/themeStore';
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

export default function ProfileScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const user = useAuthStore((state) => state.user);
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const sheetRef = useRef<BottomSheet>(null);

  function comingSoon(label: string) {
    Alert.alert(label, 'This will be available in a future update.');
  }

  const themeLabel = THEME_OPTIONS.find((opt) => opt.value === (preference ?? 'light'))?.label ?? 'Light';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.xl }]}>Profile</Text>

        <ThemeAwareCard>
          <View style={styles.row}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.softMint, borderRadius: radius.full },
              ]}
            >
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

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.xs }]}>
          PREFERENCES
        </Text>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="color-palette-outline" label="Appearance" value={themeLabel} onPress={() => sheetRef.current?.expand()} />
          <Row icon="cash-outline" label="Currency" value="USD" onPress={() => comingSoon('Currency')} />
          <Row icon="notifications-outline" label="Notifications" value="On" onPress={() => comingSoon('Notifications')} />
          <Row icon="wallet-outline" label="Payment Defaults" value="USDC on Solana" onPress={() => comingSoon('Payment Defaults')} />
        </ThemeAwareCard>

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.xs }]}>
          ACCOUNT
        </Text>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="lock-closed-outline" label="Security" onPress={() => comingSoon('Security')} />
          <Row icon="link-outline" label="Connected Wallets" onPress={() => comingSoon('Connected Wallets')} />
          <Row icon="help-circle-outline" label="Help & Support" onPress={() => comingSoon('Help & Support')} />
        </ThemeAwareCard>
      </ScrollView>

      <AppBottomSheet ref={sheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Appearance</Text>
        {THEME_OPTIONS.map((option) => {
          const isActive = (preference ?? 'light') === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                setPreference(option.value);
                sheetRef.current?.close();
              }}
              style={[styles.row, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
              {isActive ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          );
        })}
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
