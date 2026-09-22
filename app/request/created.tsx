import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, Linking, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { IconButton } from '../../src/components/IconButton';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { QRCodeCard } from '../../src/components/QRCodeCard';
import { FullScreenQRModal } from '../../src/components/FullScreenQRModal';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useWalletStore } from '../../src/store/walletStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { getPublicPaymentUrl } from '../../src/utils/publicPaymentLink';
import { isCheckoutBaseUrlConfigured } from '../../src/utils/checkoutBaseUrl';
import { buildSolanaPayUrl } from '../../src/services/blockchain/solana/solanaPayUri';
import { requestDebugLog } from '../../src/utils/requestDebugLog';

function formatExpiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  const date = new Date(expiresAt);
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `Expires ${dateLabel} · ${daysLeft}d`;
}

export default function CreatedScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const walletAddress = useWalletStore((state) => state.wallet?.address);
  const profile = useProfileStore((state) => state.profile);
  const resetDraft = useRequestDraftStore((state) => state.reset);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  // The wallet-scannable QR must be a real Solana Pay transfer-request URI
  // (see solanaPayUri.ts, the same builder /p/[token].tsx uses for its "Pay
  // with Wallet" QR) -- never the HTTPS checkout link. Phantom and other
  // Solana wallets only recognize `solana:` URIs; scanning the checkout link
  // itself here previously produced "This QR code is not valid." A merchant
  // is single-wallet-per-user today (see 0005_phase3a_payment_foundation.sql),
  // so the merchant's own configured wallet is exactly the destination this
  // request will be verified against. Declared above the `!request` early
  // return so this hook's call order never changes across renders.
  const solanaPayUri = useMemo(() => {
    if (!request || !walletAddress || !request.solanaReference) return null;
    try {
      const uri = buildSolanaPayUrl({
        recipient: walletAddress,
        reference: request.solanaReference,
        amount: request.amount,
        asset: request.currency,
        label: profile?.businessName?.trim() || profile?.displayName?.trim() || undefined,
        message: request.description ? `Payment for ${request.description}` : `Payment request ${request.paymentCode}`,
      });
      // Temporary diagnostic checkpoint -- see requestDebugLog.ts. Solana Pay
      // URIs are not secret (they're literally what's encoded into the QR a
      // payer scans), so logging the full value is safe.
      requestDebugLog('created: built Solana Pay QR URI', { uri, paymentCode: request.paymentCode });
      return uri;
    } catch {
      // Missing/invalid wallet or reference -- fail safely by not offering a
      // wallet-scan QR, rather than encoding something a wallet will reject.
      return null;
    }
  }, [request, walletAddress, profile?.businessName, profile?.displayName]);

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="alert-circle-outline"
            title="We couldn't load this request."
            description="It may still be syncing, or no longer exists."
          />
        </View>
      </SafeAreaView>
    );
  }

  const publicLink = getPublicPaymentUrl(request.publicToken);
  const isCheckoutDomainLive = isCheckoutBaseUrlConfigured();

  function handleClose() {
    resetDraft();
    router.replace('/(app)/home');
  }

  async function handleCopyLink() {
    await Clipboard.setStringAsync(publicLink);
    Alert.alert('Copied', 'Payment link copied to clipboard.');
  }

  async function handleShare() {
    await Share.share({ message: publicLink, url: publicLink });
  }

  async function handleWhatsApp() {
    const message = `You have a payment request for ${formatCurrency(request!.amount)} ${request!.currency} through Spero: ${publicLink}`;
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
        <View style={{ width: 40 }} />
        <IconButton name="close" onPress={handleClose} accessibilityLabel="Close" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, alignItems: 'center' }}>
        <View
          style={[
            styles.successIcon,
            { backgroundColor: colors.primaryAction, borderRadius: radius.full, marginTop: spacing.md },
          ]}
        >
          <Ionicons name="checkmark" size={36} color={colors.primaryActionText} />
        </View>

        <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
          Request Created!
        </Text>
        <Text
          style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}
        >
          Your payment request is ready to share.
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.xl },
          ]}
        >
          <Text style={[typography.heroNumber, { color: colors.textPrimary, textAlign: 'center' }]}>
            {formatCurrency(request.amount)} <Text style={typography.body}>{request.currency}</Text>
          </Text>
          {customer ? (
            <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}>
              To {customer.name}
            </Text>
          ) : null}

          {solanaPayUri ? (
            <>
              <Pressable
                onPress={() => setQrModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Show full-screen payment QR"
                style={({ pressed }) => ({ marginTop: spacing.lg, opacity: pressed ? 0.85 : 1 })}
              >
                <QRCodeCard value={solanaPayUri} />
              </Pressable>
              <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
                Tap to view full screen
              </Text>
            </>
          ) : (
            <Pressable
              onPress={() => router.push('/(app)/profile/wallet')}
              style={[
                styles.walletMissingNote,
                { backgroundColor: colors.softLavender, borderRadius: radius.md, marginTop: spacing.lg, padding: spacing.base },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add a receiving wallet"
            >
              <Text style={[typography.bodySmall, { color: colors.softLavenderText, textAlign: 'center' }]}>
                Add a receiving wallet to generate a scannable payment QR.
              </Text>
            </Pressable>
          )}
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}>
            {formatExpiryLabel(request.expiresAt)} · {request.paymentCode}
          </Text>
        </View>

        <View style={{ width: '100%', marginTop: spacing.xl }}>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
            Share Payment Link
          </Text>
          <View
            style={[
              styles.linkRow,
              { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.base },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}
            >
              {publicLink}
            </Text>
            <Pressable onPress={handleCopyLink} accessibilityRole="button" accessibilityLabel="Copy link" hitSlop={12}>
              <Ionicons name="copy-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          {!isCheckoutDomainLive ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
              Development link — this domain isn't deployed yet, so it won't open outside this app. Use the QR above to test payments now.
            </Text>
          ) : null}

          <View style={[styles.actionsRow, { marginTop: spacing.base, gap: spacing.md }]}>
            <IconButton name="copy-outline" onPress={handleCopyLink} accessibilityLabel="Copy link" />
            <IconButton name="share-outline" onPress={handleShare} accessibilityLabel="Share" />
            <IconButton
              name="qr-code-outline"
              onPress={() => {
                if (!solanaPayUri) return;
                setQrModalVisible(true);
              }}
              accessibilityLabel="Show QR"
            />
            <IconButton name="logo-whatsapp" onPress={handleWhatsApp} accessibilityLabel="Share on WhatsApp" />
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm }}>
        <PrimaryButton label="Share Link" onPress={handleShare} />
        <SecondaryButton label="View Invoice" onPress={() => router.push(`/request/invoice?id=${request.id}`)} />
      </View>

      <FullScreenQRModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        solanaPayUri={solanaPayUri}
        amount={request.amount}
        currency={request.currency}
        merchantName={profile?.businessName?.trim() || profile?.displayName?.trim() || undefined}
        walletAddress={walletAddress ?? undefined}
        publicLink={publicLink}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  successIcon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', alignItems: 'center', borderWidth: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', height: 52, borderWidth: 1 },
  actionsRow: { flexDirection: 'row', justifyContent: 'center' },
  walletMissingNote: { width: '100%', alignItems: 'center' },
});
