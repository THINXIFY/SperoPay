import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
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
import { COLOR_KEYS } from '../../src/components/StatusBadge';
import { fetchPublicCheckout } from '../../src/services/publicCheckout/publicCheckoutService';
import type { PublicCheckoutData, PublicCheckoutResult } from '../../src/services/publicCheckout/types';
import { getPublicPaymentUrl } from '../../src/utils/publicPaymentLink';
import { formatCurrency } from '../../src/utils/formatCurrency';

const POLL_INTERVAL_MS = 7000;
const MAX_CONTENT_WIDTH = 480;

function isTerminalStatus(status: PublicCheckoutData['status']): boolean {
  return status === 'paid' || status === 'expired' || status === 'cancelled';
}

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
  const [result, setResult] = useState<PublicCheckoutResult | null>(null);
  const [copiedField, setCopiedField] = useState<'wallet' | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!token) {
      setResult({ ok: false, code: 'invalid_token', message: 'This payment link is invalid.' });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Recursive setTimeout, not setInterval: the next poll is only ever
    // scheduled after the current one resolves, so a slow response can
    // never overlap with the next request. Stops entirely on any terminal
    // status or any error result -- an error state gets a manual Refresh
    // action instead of being retried automatically (spec sections 20-21).
    async function poll() {
      const next = await fetchPublicCheckout(token);
      if (cancelled) return;
      setResult(next);
      setIsRefreshing(false);
      if (next.ok && !isTerminalStatus(next.data.status)) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, retryKey]);

  function handleRetry() {
    setIsRefreshing(true);
    setRetryKey((key) => key + 1);
  }

  async function handleCopyWallet(address: string) {
    await Clipboard.setStringAsync(address);
    setCopiedField('wallet');
    setTimeout(() => setCopiedField((current) => (current === 'wallet' ? null : current)), 2000);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRetry} tintColor={colors.primaryAction} />}
      >
        <View style={[styles.content, { paddingHorizontal: spacing.xl, paddingTop: spacing.xl }]}>
          <View style={styles.header}>
            <Logo size={40} />
          </View>

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
                  onPress={handleRetry}
                  style={({ pressed }) => [styles.retryButton, { marginTop: spacing.lg, opacity: pressed ? 0.7 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                >
                  <Ionicons name="refresh" size={16} color={colors.primaryAction} />
                  <Text style={[typography.bodySmall, { color: colors.primaryAction, marginLeft: spacing.xs }]}>
                    Try again
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <CheckoutContent
              data={result.data}
              token={token ?? ''}
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
  token: string;
  copiedField: 'wallet' | null;
  onCopyWallet: (address: string) => void;
}

function CheckoutContent({ data, token, copiedField, onCopyWallet }: CheckoutContentProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const merchantName = data.merchantName?.trim() || 'the merchant';
  const isPending = data.status === 'pending';
  const isConfirming = data.status === 'confirming';
  const isPaid = data.status === 'paid';
  const isExpired = data.status === 'expired';
  const isCancelled = data.status === 'cancelled';

  return (
    <View style={{ marginTop: spacing.xl }}>
      {/* Summary */}
      <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
        You're paying <Text style={{ color: colors.textPrimary }}>{merchantName}</Text>
      </Text>
      <Text style={[typography.display, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.sm }]}>
        {formatCurrency(data.amount)}
      </Text>
      <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}>
        {data.amount} {data.currency} · {data.network} network
      </Text>

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
        <View style={[styles.statusArea, { backgroundColor: colors.softMint, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl }]}>
          <Ionicons name="checkmark-circle" size={32} color={colors.softMintText} />
          <Text style={[typography.h3, { color: colors.softMintText, marginTop: spacing.sm }]}>Payment received</Text>
          <Text style={[typography.bodySmall, { color: colors.softMintText, marginTop: spacing.xs / 2, textAlign: 'center' }]}>
            {merchantName} has been notified.
          </Text>
        </View>
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
      ) : null}

      {/* Payment details */}
      <ThemeAwareCard style={{ marginTop: spacing.xl }}>
        <DetailRow label="To" value={merchantName} />
        <DetailRow label="Network" value={data.network} />
        <DetailRow label="Stablecoin" value={data.currency} />
        <DetailRow label="Request ID" value={data.paymentCode} />
        {data.description ? <DetailRow label="Description" value={data.description} /> : null}
        {data.expiresAt ? <DetailRow label="Expires" value={formatExpiry(data.expiresAt)} last /> : null}
      </ThemeAwareCard>

      {/* Payment destination + QR — only while a payment is actually still expected */}
      {isPending && data.destinationWallet ? (
        <>
          <ThemeAwareCard style={{ marginTop: spacing.base }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Receiving wallet</Text>
            <View style={[styles.walletRow, { marginTop: spacing.xs }]}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                {truncateWallet(data.destinationWallet)}
              </Text>
              <Pressable
                onPress={() => onCopyWallet(data.destinationWallet as string)}
                style={({ pressed }) => [styles.copyButton, { opacity: pressed ? 0.7 : 1 }]}
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

          <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
            <QRCodeCard value={getPublicPaymentUrl(token)} size={160} />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
              Scan to open this payment page on another device
            </Text>
          </View>
        </>
      ) : null}

      {/* Trust note */}
      <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
        Funds are sent directly to the merchant's wallet. Spero never holds your funds.
      </Text>
    </View>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={[
        styles.detailRow,
        { paddingVertical: spacing.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.bodySmall, { color: colors.textPrimary, flex: 1, textAlign: 'right', marginLeft: 12 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, paddingBottom: 48 },
  header: { alignItems: 'center' },
  statusArea: { alignItems: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletRow: { flexDirection: 'row', alignItems: 'center' },
  copyButton: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  retryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
