import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Share, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { DetailRow } from '../../src/components/DetailRow';
import { Logo } from '../../src/components/Logo';
import { EmptyState } from '../../src/components/EmptyState';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { useRefreshMerchantPaymentData } from '../../src/store/useRefreshMerchantPaymentData';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatDocumentDate } from '../../src/utils/formatDocumentDate';
import { getReceiptId } from '../../src/utils/documentIds';
import { buildReceiptShareMessage } from '../../src/utils/buildReceiptShareMessage';
import { truncateHash } from '../../src/utils/truncateHash';

export default function ReceiptScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const profile = useProfileStore((state) => state.profile);
  const transaction = useTransactionStore((state) => (request ? state.getTransactionForRequest(request.id) : undefined));
  const [copiedHash, setCopiedHash] = useState(false);
  const copiedHashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedHashTimeout.current) clearTimeout(copiedHashTimeout.current);
  }, []);
  const { refresh: refreshPaymentData, isRefreshing } = useRefreshMerchantPaymentData();

  if (!request || request.status !== 'paid') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Receipt" onBackPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="receipt-outline"
            title="We couldn't load this receipt."
            description="Receipts are only available for completed payments."
          />
        </View>
      </SafeAreaView>
    );
  }

  const receiptId = getReceiptId(request);
  const businessName = profile?.businessName?.trim() || profile?.displayName || 'Your business';

  async function handleShare() {
    if (!request) return;
    await Share.share({ message: buildReceiptShareMessage(request) });
  }

  async function handleViewTransaction() {
    if (!request) return;
    if (!transaction) return;
    await Clipboard.setStringAsync(transaction.txHash);
    setCopiedHash(true);
    if (copiedHashTimeout.current) clearTimeout(copiedHashTimeout.current);
    copiedHashTimeout.current = setTimeout(() => setCopiedHash(false), 2000);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Receipt" onBackPress={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refreshPaymentData} />}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Logo size={40} />
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.sm }]}>SperoPay</Text>
        </View>

        <ThemeAwareCard variant="hero" style={{ alignItems: 'center' }}>
          <View
            style={[
              styles.checkCircle,
              { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.primaryActionSoft },
            ]}
          >
            <Ionicons name="checkmark" size={26} color={colors.primaryAction} />
          </View>
          <Text style={[typography.h3, { color: colors.heroSurfaceText, marginTop: spacing.md }]}>
            Payment Received
          </Text>
          <Text style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted, marginTop: spacing.xs / 2 }]}>
            Verified on {request.network}
          </Text>
          <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.lg }]}>
            {request.amount} {request.currency}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted, marginTop: spacing.xs }]}>
            ≈ {formatCurrency(request.amount)}
          </Text>
        </ThemeAwareCard>

        <ThemeAwareCard style={{ marginTop: spacing.lg, padding: spacing.xl }}>
          <View style={[styles.docHeaderRow, { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Receipt ID</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{receiptId}</Text>
            </View>
            <View style={[styles.verifiedPill, { backgroundColor: colors.softMint, borderRadius: radius.full, paddingHorizontal: spacing.sm }]}>
              <Ionicons name="shield-checkmark" size={12} color={colors.softMintText} />
              <Text style={[typography.caption, { color: colors.softMintText, marginLeft: spacing.xs / 2 }]}>Verified</Text>
            </View>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <DetailRow label="Merchant" value={businessName} />
            <DetailRow label="Customer" value={customer?.name ?? 'No customer'} />
            {request.description ? <DetailRow label="Description" value={request.description} /> : null}
            <DetailRow label="Network" value={request.network} last={!transaction} />
            {transaction ? <DetailRow label="Paid Date" value={formatDocumentDate(transaction.paidAt)} /> : null}
            {transaction ? (
              <DetailRow label="Transaction" value={truncateHash(transaction.txHash)} last />
            ) : (
              // The request's own status already says paid -- a real payment
              // is verified and its transaction row written atomically, so
              // this only ever happens for a moment right after this
              // screen's own store data was fetched. A brief note, not an
              // error state.
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginLeft: spacing.sm }]}>
                  Syncing transaction details…
                </Text>
              </View>
            )}
          </View>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="Share Receipt" icon="share-outline" onPress={handleShare} />
          {transaction ? (
            <SecondaryButton
              label={copiedHash ? 'Copied' : 'Copy Transaction Hash'}
              icon={copiedHash ? 'checkmark' : 'copy-outline'}
              onPress={handleViewTransaction}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  checkCircle: { alignItems: 'center', justifyContent: 'center' },
  docHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
});
