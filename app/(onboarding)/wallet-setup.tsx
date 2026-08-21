import { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { useWalletStore } from '../../src/store/walletStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useAuthStore } from '../../src/store/authStore';
import { isValidWalletAddress } from '../../src/utils/validators';

export default function WalletSetupScreen() {
  const { colors, spacing, typography } = useTheme();
  const wallet = useWalletStore((state) => state.wallet);
  const setWalletAddress = useWalletStore((state) => state.setWalletAddress);
  const completeOnboarding = useProfileStore((state) => state.completeOnboarding);
  const userId = useAuthStore((state) => state.user?.id);

  // Pre-fill from any wallet already configured on this device — matters
  // because per-user onboarding completion (unlike the old single global
  // flag) can now genuinely send a user who previously finished setup
  // through this screen again, and an empty field here would otherwise
  // silently risk losing their real receiving address.
  const [address, setAddress] = useState(wallet?.address ?? '');
  const [error, setError] = useState<string | undefined>();

  async function handleComplete() {
    if (!isValidWalletAddress(address.trim())) {
      setError('Enter a valid Solana wallet address');
      return;
    }
    if (!userId) return; // Onboarding is only reachable while authenticated.
    try {
      await setWalletAddress(userId, address.trim());
      await completeOnboarding(userId);
      router.replace('/(app)/home');
    } catch {
      setError("We couldn't finish setup. Check your connection and try again.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Wallet Setup" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Where should payments go?</Text>

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.base }}>
            <ThemeAwareCard style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Stablecoin</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>USDC</Text>
            </ThemeAwareCard>
            <ThemeAwareCard style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Network</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>Solana</Text>
            </ThemeAwareCard>
          </View>

          <TextField
            label="Receiving Wallet Address"
            value={address}
            onChangeText={setAddress}
            error={error}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter your Solana wallet address"
          />

          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.softBlue,
              borderRadius: 12,
              padding: spacing.base,
              marginTop: spacing.sm,
              gap: spacing.sm,
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.softBlueText} />
            <Text style={[typography.bodySmall, { color: colors.softBlueText, flex: 1 }]}>
              Spero never asks for your seed phrase or private key.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Complete Setup" onPress={handleComplete} />
      </View>
    </SafeAreaView>
  );
}
