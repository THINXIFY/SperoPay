import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useTheme } from '../../src/theme/useTheme';
import { Logo } from '../../src/components/Logo';
import { BusinessLogo } from '../../src/components/BusinessLogo';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { EmptyState } from '../../src/components/EmptyState';
import { SkeletonLoader } from '../../src/components/SkeletonLoader';
import { QRCodeCard } from '../../src/components/QRCodeCard';
import { FullScreenQRModal } from '../../src/components/FullScreenQRModal';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { DetailRow } from '../../src/components/DetailRow';
import { usePublicCheckoutPolling } from '../../src/services/publicCheckout/usePublicCheckoutPolling';
import { usePayWithWallet } from '../../src/services/publicCheckout/usePayWithWallet';
import { useRefreshOnForeground } from '../../src/services/publicCheckout/useRefreshOnForeground';
import { canPayRequest } from '../../src/services/publicCheckout/canPayRequest';
import { recordRequestViewed } from '../../src/services/publicCheckout/publicCheckoutService';
import type { PublicCheckoutData } from '../../src/services/publicCheckout/types';
import { buildSolanaPayUrl } from '../../src/services/blockchain/solana/solanaPayUri';
import { getSolanaEnvironment } from '../../src/services/blockchain/solana/config';
import { getAssetDecimals } from '../../src/config/assets';
import { toBaseUnits } from '../../src/services/blockchain/solana/amount';
import { computeDepositAmount } from '../../src/utils/paymentAccounting';
import { formatCurrency } from '../../src/utils/formatCurrency';

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

  // Phase 6C: recorded once per token, independent of usePublicCheckoutPolling's
  // own repeating poll -- see recordRequestViewed's own comment for why.
  useEffect(() => {
    if (!token) return;
    recordRequestViewed(token);
  }, [token]);

  async function handleCopyWallet(address: string) {
    await Clipboard.setStringAsync(address);
    setCopiedField('wallet');
    setTimeout(() => setCopiedField((current) => (current === 'wallet' ? null : current)), 2000);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      {/* Phase 5B: a public, unauthenticated, shareable link must never be
          indexed or surface real payment details in link-preview/social
          metadata (spec sections 16) -- generic copy only, never the
          amount, customer name, or wallet address. expo-router/head only
          actually applies while this screen is focused (react-helmet-async
          under the hood), so it can never leak into some other route's
          <head>. */}
      <Head>
        <title>Spero — Secure Payment Request</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Spero" />
        <meta property="og:description" content="Secure payment request" />
      </Head>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
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
                icon={result.code === 'network_error' ? 'cloud-offline-outline' : 'alert-circle-outline'}
                title={
                  result.code === 'network_error'
                    ? "We couldn't load this payment request."
                    : 'This payment link is not available.'
                }
                description={result.message}
              />
              {result.code === 'network_error' ? (
                <Pressable
                  onPress={refresh}
                  disabled={isRefreshing}
                  style={({ pressed }) => [styles.retryButton, { marginTop: spacing.lg, opacity: isRefreshing || pressed ? 0.6 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Try Again"
                  accessibilityState={{ disabled: isRefreshing, busy: isRefreshing }}
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color={colors.primaryAction} />
                  ) : (
                    <Ionicons name="refresh" size={16} color={colors.primaryAction} />
                  )}
                  <Text style={[typography.bodySmall, { color: colors.primaryAction, marginLeft: spacing.xs }]}>
                    {isRefreshing ? 'Trying again…' : 'Try Again'}
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

  // Partial-payment amount selection -- "remaining" (the default, pre-
  // selected) or a merchant-permitted custom amount within
  // [required deposit or any amount, remaining]. Irrelevant, and never
  // rendered, for a full-payment-only request, which keeps paying its
  // exact fixed amount exactly as it always has.
  const isPartial = data.allowPartialPayments;
  const [paymentChoice, setPaymentChoice] = useState<'remaining' | 'custom'>('remaining');
  const [customAmountText, setCustomAmountText] = useState('');
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const requiredMinimum = useMemo(() => {
    if (!isPartial) return data.amount;
    if (data.verifiedPaidAmount > 0) return 0; // any positive amount is fine once a first payment already exists
    return computeDepositAmount(data.amount, data.depositType ?? undefined, data.depositValue ?? undefined) ?? 0;
  }, [isPartial, data.amount, data.verifiedPaidAmount, data.depositType, data.depositValue]);

  const customAmount = Number(customAmountText);
  const decimals = getAssetDecimals(data.currency);
  // Exact base-unit comparison, never a float `>`/`<` on the decimal values
  // themselves -- the same reasoning as every other money comparison in
  // this app (see amount.ts).
  const customAmountError = (() => {
    if (paymentChoice !== 'custom') return undefined;
    if (customAmountText.trim().length === 0 || Number.isNaN(customAmount) || customAmount <= 0) {
      return 'Enter an amount';
    }
    const enteredBaseUnits = toBaseUnits(customAmountText.trim(), decimals);
    if (enteredBaseUnits > toBaseUnits(data.remainingAmount, decimals)) {
      return `Amount can't exceed ${formatCurrency(data.remainingAmount)}`;
    }
    if (requiredMinimum > 0 && enteredBaseUnits < toBaseUnits(requiredMinimum, decimals)) {
      return `A minimum of ${formatCurrency(requiredMinimum)} is required`;
    }
    return undefined;
  })();

  const amountToPay = !isPartial ? data.amount : paymentChoice === 'remaining' ? data.remainingAmount : customAmount;
  const amountIsValid = !isPartial || (paymentChoice === 'remaining' ? data.remainingAmount > 0 : !customAmountError && customAmount > 0);

  const solanaPayUri = useMemo(() => {
    if (!data.destinationWallet || !data.solanaReference || !amountIsValid) return null;
    try {
      return buildSolanaPayUrl({
        recipient: data.destinationWallet,
        reference: data.solanaReference,
        amount: amountToPay,
        asset: data.currency,
        label: merchantName,
        message: data.description ? `Payment for ${data.description}` : `Payment request ${data.paymentCode}`,
      });
    } catch {
      // Invalid wallet/reference data -- fail safely by simply not offering
      // a Pay With Wallet flow, rather than crashing or opening a broken URI.
      return null;
    }
  }, [data.destinationWallet, data.solanaReference, amountToPay, amountIsValid, data.currency, data.description, data.paymentCode, merchantName]);

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
      {/* Summary -- the merchant's logo is only shown when they've actually
          set one (never a fallback-initials box here); it adds a real
          trust signal for the payer without decorating a link that has
          nothing to show. */}
      {data.merchantLogoUrl ? (
        <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
          <BusinessLogo name={merchantName} logoUrl={data.merchantLogoUrl} size={48} />
        </View>
      ) : null}
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

      {isPartial ? (
        <ThemeAwareCard style={{ marginTop: spacing.lg }}>
          <View style={styles.summaryRow}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Amount due</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{formatCurrency(data.amount)}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: spacing.sm }]}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Paid</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{formatCurrency(data.verifiedPaidAmount)}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: spacing.sm }]}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Remaining</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{formatCurrency(data.remainingAmount)}</Text>
          </View>
        </ThemeAwareCard>
      ) : null}

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
            title="This payment request has expired."
            description="Ask the merchant to send a new payment link."
          />
        </View>
      ) : isCancelled ? (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState
            icon="close-circle-outline"
            title="This payment request has been cancelled."
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
          {isPartial && data.remainingAmount > 0 ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Pressable
                onPress={() => setPaymentChoice('remaining')}
                accessibilityRole="radio"
                accessibilityState={{ selected: paymentChoice === 'remaining' }}
                style={[
                  styles.amountChoiceRow,
                  {
                    borderColor: paymentChoice === 'remaining' ? colors.primaryAction : colors.border,
                    backgroundColor: paymentChoice === 'remaining' ? colors.softMint : colors.surface,
                    borderRadius: radius.md,
                    padding: spacing.base,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                <Ionicons
                  name={paymentChoice === 'remaining' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={paymentChoice === 'remaining' ? colors.softMintText : colors.textMuted}
                />
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>
                  Pay remaining balance
                </Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{formatCurrency(data.remainingAmount)}</Text>
              </Pressable>

              <Pressable
                onPress={() => setPaymentChoice('custom')}
                accessibilityRole="radio"
                accessibilityState={{ selected: paymentChoice === 'custom' }}
                style={[
                  styles.amountChoiceRow,
                  {
                    borderColor: paymentChoice === 'custom' ? colors.primaryAction : colors.border,
                    backgroundColor: paymentChoice === 'custom' ? colors.softMint : colors.surface,
                    borderRadius: radius.md,
                    padding: spacing.base,
                  },
                ]}
              >
                <Ionicons
                  name={paymentChoice === 'custom' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={paymentChoice === 'custom' ? colors.softMintText : colors.textMuted}
                />
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                  Enter another amount
                </Text>
              </Pressable>

              {paymentChoice === 'custom' ? (
                <View style={{ marginTop: spacing.sm }}>
                  <View
                    style={[
                      styles.customAmountRow,
                      {
                        borderColor: customAmountError ? colors.error : colors.border,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.base,
                      },
                    ]}
                  >
                    <TextInput
                      value={customAmountText}
                      onChangeText={setCustomAmountText}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1, paddingVertical: spacing.md }]}
                      accessibilityLabel="Custom payment amount"
                    />
                    <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{data.currency}</Text>
                  </View>
                  {customAmountError ? (
                    <Text style={[typography.caption, { color: colors.error, marginTop: spacing.xs }]}>{customAmountError}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

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
              <Pressable
                onPress={() => setQrModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Show full-screen payment QR"
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <QRCodeCard value={solanaPayUri} size={180} />
              </Pressable>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
                Tap to view full screen
              </Text>
            </View>
          ) : null}

          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            Send {data.currency} on Solana only.
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
              <DetailRow label="Amount" value={`${amountToPay.toFixed(2)} ${data.currency}`} />
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

      <FullScreenQRModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        solanaPayUri={solanaPayUri}
        amount={amountToPay}
        currency={data.currency}
        merchantName={data.merchantName ?? undefined}
        walletAddress={data.destinationWallet ?? undefined}
      />
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
  amountChoiceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  customAmountRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
