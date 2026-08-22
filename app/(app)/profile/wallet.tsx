import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { SecondaryButton } from '../../../src/components/SecondaryButton';
import { useWalletStore } from '../../../src/store/walletStore';
import { useAuthStore } from '../../../src/store/authStore';
import { isValidWalletAddress } from '../../../src/utils/validators';

export default function WalletSettingsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const wallet = useWalletStore((state) => state.wallet);
  const setWalletAddress = useWalletStore((state) => state.setWalletAddress);
  const userId = useAuthStore((state) => state.user?.id);

  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress] = useState(wallet?.address ?? '');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  function handleCopy() {
    if (!wallet) return;
    Clipboard.setStringAsync(wallet.address);
    Alert.alert('Copied', 'Wallet address copied to clipboard.');
  }

  function handleStartEdit() {
    setAddress(wallet?.address ?? '');
    setError(undefined);
    setIsEditing(true);
  }

  async function handleSave() {
    if (isSaving) return;
    if (!isValidWalletAddress(address.trim())) {
      setError('Enter a valid Solana wallet address');
      return;
    }
    if (!userId) return;
    setIsSaving(true);
    try {
      await setWalletAddress(userId, address.trim());
      setIsEditing(false);
    } catch {
      setError("We couldn't save that. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Wallet Settings" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.base }}>
            <ThemeAwareCard style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Stablecoin</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>USDC</Text>
            </ThemeAwareCard>
            <ThemeAwareCard style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Network</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>Solana</Text>
            </ThemeAwareCard>
          </View>

          {isEditing ? (
            <>
              <TextField
                label="Receiving Wallet Address"
                value={address}
                onChangeText={setAddress}
                error={error}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton label="Cancel" onPress={() => setIsEditing(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Save" onPress={handleSave} loading={isSaving} />
                </View>
              </View>
            </>
          ) : (
            <ThemeAwareCard>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Receiving Wallet</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs }]} numberOfLines={1}>
                {wallet?.address ?? 'Not set'}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
                <Pressable
                  onPress={handleCopy}
                  style={[styles.actionRow, { borderColor: colors.border, borderRadius: radius.md }]}
                  accessibilityRole="button"
                  accessibilityLabel="Copy wallet address"
                >
                  <Ionicons name="copy-outline" size={16} color={colors.textPrimary} />
                  <Text style={[typography.bodySmall, { color: colors.textPrimary, marginLeft: spacing.xs }]}>Copy</Text>
                </Pressable>
                <Pressable
                  onPress={handleStartEdit}
                  style={[styles.actionRow, { borderColor: colors.border, borderRadius: radius.md }]}
                  accessibilityRole="button"
                  accessibilityLabel="Edit wallet address"
                >
                  <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                  <Text style={[typography.bodySmall, { color: colors.textPrimary, marginLeft: spacing.xs }]}>Edit</Text>
                </Pressable>
              </View>
            </ThemeAwareCard>
          )}

          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.softBlue,
              borderRadius: radius.md,
              padding: spacing.base,
              marginTop: spacing.base,
              gap: spacing.sm,
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.softBlueText} />
            <Text style={[typography.bodySmall, { color: colors.softBlueText, flex: 1 }]}>
              Spero never asks for your seed phrase or private key. Payments are designed to go directly to your receiving wallet.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
});
