import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Animated, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { Logo } from '../../src/components/Logo';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { EmptyState } from '../../src/components/EmptyState';
import { SkeletonLoader } from '../../src/components/SkeletonLoader';
import { QRCodeCard } from '../../src/components/QRCodeCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { DetailRow } from '../../src/components/DetailRow';
import { usePublicCheckoutPolling } from '../../src/services/publicCheckout/usePublicCheckoutPolling';
import { usePayWithWallet } from '../../src/services/publicCheckout/usePayWithWallet';
import { useRefreshOnForeground } from '../../src/services/publicCheckout/useRefreshOnForeground';
import { canPayRequest } from '../../src/services/publicCheckout/canPayRequest';
import type { PublicCheckoutData } from '../../src/services/publicCheckout/types';
import { buildSolanaPayUrl } from '../../src/services/blockchain/solana/solanaPayUri';
import { getSolanaEnvironment } from '../../src/services/blockchain/solana/config';

const MAX_CONTENT_WIDTH = 480;

function truncateWallet(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatExpiry(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    new Date(isoDate)
  );
}

export default function PublicCheckoutScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors, spacing, radius, typography } = useTheme();
  const { result, isOffline, isRefreshing, refresh } = usePublicCheckoutPolling(token);
  const [copiedField, setCopiedField] = useState<'wallet' | null>(null);

  useRefreshOnForeground(refresh);

  async function handleCopyWallet(address: string) {
    await Clipboard.setStringAsync(address);
    setCopiedField('wallet');
    setTimeout(() => setCopiedField((current) => (current === 'wallet' ? null : current)), 2000);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primaryAction} />}
      >
        <View style={[styles.content, { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl + spacing.base }]}>
          <View style={styles.header}>
            <Logo size={40} />
          </View>

          {isOffline ? (
            <View
              style={[
                styles.offlineBanner,
                { backgroundColor: colors.softLavender, borderRadius: radius.md, marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.base },
              ]}
            >
              <Ionicons name="cloud-offline-outline" size={14} color={colors.softLavenderText} />
              <Text style={[typography.caption, { color: colors.softLavenderText, marginLeft: spacing.xs, flex: 1 }]}>
                You're offline. We'll check your payment when you're back online.
              </Text>
            </View>
          ) : null}

          {result === null ? (
            <CheckoutSkeleton />
          ) : !result.ok ? (
            <View style={{ marginTop: spacing.xxl }}>
              <EmptyState
                icon="alert-circle-outline"
                title="Payment link unavailable"
                description={result.message}
              />
              {result.code === 'network_error' ? (
                <Pressable
                  onPress={refresh}
                  disabled={isRefreshing}
                  style={({ pressed }) => [styles.retryButton, { marginTop: spacing.lg, opacity: isRefreshing || pressed ? 0.6 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                  accessibilityState={{ disabled: isRefreshing, busy: isRefreshing }}
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color={colors.primaryAction} />
                  ) : (
                    <Ionicons name="refresh" size={16} color={colors.primaryAction} />
                  )}
                  <Text style={[typography.bodySmall, { color: colors.primaryAction, marginLeft: spacing.xs }]}>
                    {isRefreshing ? 'Trying again…' : 'Try again'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <CheckoutContent
              data={result.data}
              copiedField={copiedField}
              onCopyWallet={handleCopyWallet}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckoutSkeleton() {
  const { spacing, radius } = useTheme();
  return (
    <View style={{ marginTop: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
      <SkeletonLoader width="60%" height={18} />
      <SkeletonLoader width="40%" height={40} style={{ marginTop: spacing.sm }} />
      <SkeletonLoader width="30%" height={14} />
      <SkeletonLoader width="100%" height={140} style={{ marginTop: spacing.xl, borderRadius: radius.lg }} />
    </View>
  );
}

interface CheckoutContentProps {
  data: PublicCheckoutData;
  copiedField: 'wallet' | null;
  onCopyWallet: (address: string) => void;
}

function CheckoutContent({ data, copiedField, onCopyWallet }: CheckoutContentProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const merchantName = data.merchantName?.trim() || 'the merchant';
  const isConfirming = data.status === 'confirming';
  const isPaid = data.status === 'paid';
  const isExpired = data.status === 'expired';
  const isCancelled = data.status === 'cancelled';
  const isDevnet = getSolanaEnvironment() !== 'mainnet-beta';

  const { pay, isProcessing, hasInitiated, error: payError } = usePayWithWallet();

  const solanaPayUri = useMemo(() => {
    if (!data.destinationWallet || !data.solanaReference) return null;
    try {
      return buildSolanaPayUrl({
        recipient: data.destinationWallet,
        reference: data.solanaReference,
        amount: data.amount,
        label: merchantName,
        message: data.description ? `Payment for ${data.description}` : `Payment request ${data.paymentCode}`,
      });
    } catch {
      // Invalid wallet/reference data -- fail safely by simply not offering
      // a Pay With Wallet flow, rather than crashing or opening a broken URI.
      return null;
    }
  }, [data.destinationWallet, data.solanaReference, data.amount, data.description, data.paymentCode, merchantName]);

  const canPay = canPayRequest(data.status) && !hasInitiated;

  // A one-shot entrance for the reassurance moment when a payment lands --
  // scale/opacity only (no layout-affecting animation). Seeded at the
  // hidden values UNCONDITIONALLY (not gated on isPaid at mount time):
  // useRef's initializer only ever runs once, so gating it on isPaid would
  // freeze these at "already visible" for a request that starts unpaid and
  // later transitions to paid -- exactly the live-transition case this
  // animation exists for. Seeding hidden always and letting the effect
  // below animate to visible the first time isPaid becomes true (whether
  // that's on this initial render, for a link opened after it was already
  // paid, or on a later poll) covers both cases with one code path.
  const paidScale = useRef(new Animated.Value(0.9)).current;
  const paidOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isPaid) return;
    Animated.parallel([
      Animated.spring(paidScale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
      Animated.timing(paidOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    // isPaid is the only meaningful trigger -- the Animated.Value refs are
    // stable across renders and intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaid]);

  return (
    <View style={{ marginTop: spacing.xl }}>
      {/* Summary */}
      <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
        You're paying <Text style={{ color: colors.textPrimary }}>{merchantName}</Text>
      </Text>
      <Text style={[typography.display, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.sm }]}>
        {data.amount.toFixed(2)} {data.currency}
      </Text>
      <View style={[styles.networkRow, { marginTop: spacing.xs }]}>
        <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{data.network}</Text>
        {isDevnet ? (
          <View
            style={[
              styles.devnetBadge,
              {
                backgroundColor: colors.softLavender,
                borderRadius: radius.full,
                marginLeft: spacing.xs,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs / 2,
              },
            ]}
          >
            <Text style={[typography.caption, { color: colors.softLavenderText }]}>Devnet</Text>
          </View>
        ) : null}
      </View>

      {/* Status-specific area */}
      {isConfirming ? (
        <View style={[styles.statusArea, { backgroundColor: colors.softBlue, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl }]}>
          <ActivityIndicator color={colors.softBlueText} />
          <Text style={[typography.bodyMedium, { color: colors.softBlueText, marginTop: spacing.sm }]}>
            Payment detected
          </Text>
          <Text style={[typography.bodySmall, { color: colors.softBlueText, marginTop: spacing.xs / 2, textAlign: 'center' }]}>
            Confirming on {data.network}…
          </Text>
        </View>
      ) : isPaid ? (
        <Animated.View
          style={[
            styles.statusArea,
            {
              backgroundColor: colors.softMint,
              borderRadius: radius.lg,
              padding: spacing.xl,
              marginTop: spacing.xl,
              opacity: paidOpacity,
              transform: [{ scale: paidScale }],
            },
          ]}
        >
          <View style={[styles.paidCheckCircle, { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.surface }]}>
            <Ionicons name="checkmark" size={30} color={colors.softMintText} />
          </View>
          <Text style={[typography.h3, { color: colors.softMintText, marginTop: spacing.md }]}>Payment Received</Text>
          <Text style={[typography.bodySmall, { color: colors.softMintText, marginTop: spacing.xs / 2, textAlign: 'center' }]}>
            {merchantName} has been notified. This payment is verified on-chain.
          </Text>
        </Animated.View>
      ) : isExpired ? (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState
            icon="time-outline"
            title="This payment request has expired"
            description="Ask the merchant to send a new payment link."
          />
        </View>
      ) : isCancelled ? (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState
            icon="close-circle-outline"
            title="This payment request was cancelled"
            description="This link is no longer active."
          />
        </View>
      ) : hasInitiated ? (
        <View style={[styles.statusArea, { backgroundColor: colors.softBlue, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl }]}>
          <ActivityIndicator color={colors.softBlueText} />
          <Text style={[typography.bodyMedium, { color: colors.softBlueText, marginTop: spacing.sm, textAlign: 'center' }]}>
            Checking for your payment…
          </Text>
        </View>
      ) : canPay ? (
        <View
          style={[
            styles.statusArea,
            { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl },
          ]}
        >
          <Ionicons name="time-outline" size={28} color={colors.textMuted} />
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            Waiting for payment
          </Text>
        </View>
      ) : null}

      {/* Pay controls -- only while the request is genuinely still payable */}
      {canPay ? (
        <View style={{ marginTop: spacing.xl }}>
          <PrimaryButton
            label="Pay with Wallet"
            onPress={() => pay(solanaPayUri)}
            loading={isProcessing}
            disabled={!solanaPayUri}
          />
          {payError ? (
            <Text style={[typography.bodySmall, { color: colors.error, textAlign: 'center', marginTop: spacing.sm }]}>
              {payError}
            </Text>
          ) : null}

          {solanaPayUri ? (
            <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                Or scan to pay
              </Text>
              <QRCodeCard value={solanaPayUri} size={180} />
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
                Scan with a Solana wallet
              </Text>
            </View>
          ) : null}

          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            Send USDC on Solana only.
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs / 2 }]}>
            Funds go directly to the merchant's wallet. Spero never holds your funds.
          </Text>

          {data.destinationWallet ? (
            <ThemeAwareCard style={{ marginTop: spacing.xl }}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                Manual payment details
              </Text>
              <DetailRow label="Stablecoin" value={data.currency} />
              <DetailRow label="Network" value={data.network} />
              <DetailRow label="Amount" value={`${data.amount.toFixed(2)} ${data.currency}`} />
              <View style={[styles.walletRow, { marginTop: spacing.sm }]}>
                <Text style={[typography.bodySmall, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                  {truncateWallet(data.destinationWallet)}
                </Text>
                <Pressable
                  onPress={() => onCopyWallet(data.destinationWallet as string)}
                  style={({ pressed }) => [styles.copyButton, { opacity: pressed ? 0.7 : 1, marginLeft: spacing.md }]}
                  accessibilityRole="button"
                  accessibilityLabel="Copy receiving wallet address"
                  hitSlop={8}
                >
                  <Ionicons
                    name={copiedField === 'wallet' ? 'checkmark' : 'copy-outline'}
                    size={16}
                    color={copiedField === 'wallet' ? colors.success : colors.textSecondary}
                  />
                  <Text
                    style={[
                      typography.caption,
                      { color: copiedField === 'wallet' ? colors.success : colors.textSecondary, marginLeft: spacing.xs / 2 },
                    ]}
                  >
                    {copiedField === 'wallet' ? 'Copied' : 'Copy'}
                  </Text>
                </Pressable>
              </View>
            </ThemeAwareCard>
          ) : null}
        </View>
      ) : null}

      {/* General request details */}
      <ThemeAwareCard style={{ marginTop: spacing.xl }}>
        <DetailRow label="To" value={merchantName} />
        <DetailRow label="Network" value={data.network} />
        <DetailRow label="Stablecoin" value={data.currency} />
        <DetailRow label="Request ID" value={data.paymentCode} />
        {data.description ? <DetailRow label="Description" value={data.description} /> : null}
        {data.expiresAt ? <DetailRow label="Expires" value={formatExpiry(data.expiresAt)} last /> : null}
      </ThemeAwareCard>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  header: { alignItems: 'center' },
  statusArea: { alignItems: 'center' },
  paidCheckCircle: { alignItems: 'center', justifyContent: 'center' },
  networkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  devnetBadge: {},
  walletRow: { flexDirection: 'row', alignItems: 'center' },
  copyButton: { flexDirection: 'row', alignItems: 'center' },
  retryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center' },
});
