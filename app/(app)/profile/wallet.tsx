import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { TAB_BAR_CONTENT_HEIGHT } from '../../../src/components/BottomNavigation';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { SecondaryButton } from '../../../src/components/SecondaryButton';
import { ConfirmationModal } from '../../../src/components/ConfirmationModal';
import { useWalletStore } from '../../../src/store/walletStore';
import { useRequestStore } from '../../../src/store/requestStore';
import { useAuthStore } from '../../../src/store/authStore';
import { isValidWalletAddress } from '../../../src/utils/validators';
import { SUPPORTED_ASSETS } from '../../../src/config/assets';

export default function WalletSettingsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const wallet = useWalletStore((state) => state.wallet);
  const setWalletAddress = useWalletStore((state) => state.setWalletAddress);
  const requests = useRequestStore((state) => state.requests);
  const userId = useAuthStore((state) => state.user?.id);

  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress] = useState(wallet?.address ?? '');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  // Phase 5D audit finding: verify-payment resolves the merchant's
  // receiving wallet LIVE by user_id at verification time (never a
  // per-request snapshot), and the public checkout page displays that same
  // live address -- so changing it takes effect immediately for every
  // still-open request, not just new ones. That's a coherent rule (what a
  // payer sees always matches what verification checks against), but a
  // merchant silently changing wallets while a request is already shared
  // could confuse a payer who cached the old address before the change.
  // This confirmation is the cheap mitigation: informed consent before an
  // edit (never shown on the very first save, when nothing is outstanding
  // against any prior address).
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const outstandingCount = requests.filter((r) => r.status === 'pending' || r.status === 'confirming').length;

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

  function handleSave() {
    if (isSaving) return;
    const trimmed = address.trim();
    if (!isValidWalletAddress(trimmed)) {
      setError('Enter a valid Solana wallet address');
      return;
    }
    // Only an actual CHANGE to an EXISTING wallet needs the warning -- the
    // very first save (wallet is null) has no prior address any request
    // could already be relying on.
    if (wallet && trimmed !== wallet.address && outstandingCount > 0) {
      setPendingAddress(trimmed);
      return;
    }
    void saveAddress(trimmed);
  }

  async function saveAddress(trimmed: string) {
    if (!userId) return;
    setIsSaving(true);
    try {
      await setWalletAddress(userId, trimmed);
      setIsEditing(false);
      setPendingAddress(null);
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
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: TAB_BAR_CONTENT_HEIGHT + spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.base }}>
            <ThemeAwareCard style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Accepted Assets</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                {SUPPORTED_ASSETS.join(' · ')}
              </Text>
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
                placeholder="Enter your Solana wallet address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
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
                  style={[
                    styles.actionRow,
                    { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Copy wallet address"
                  hitSlop={6}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.textPrimary} />
                  <Text style={[typography.bodySmall, { color: colors.textPrimary, marginLeft: spacing.xs }]}>Copy</Text>
                </Pressable>
                <Pressable
                  onPress={handleStartEdit}
                  style={[
                    styles.actionRow,
                    { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Edit wallet address"
                  hitSlop={6}
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

      <ConfirmationModal
        visible={pendingAddress !== null}
        title="Change receiving wallet?"
        description={`You have ${outstandingCount} outstanding ${outstandingCount === 1 ? 'request' : 'requests'} still awaiting payment. Changing your wallet takes effect immediately -- any payment sent to your old address after this change will not be detected.`}
        confirmLabel="Change Wallet"
        cancelLabel="Keep Current Wallet"
        onConfirm={() => pendingAddress && saveAddress(pendingAddress)}
        onCancel={() => setPendingAddress(null)}
        loading={isSaving}
        icon="swap-horizontal-outline"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
});
