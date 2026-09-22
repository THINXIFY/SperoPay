import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useTheme } from '../../src/theme/useTheme';
import { Logo } from '../../src/components/Logo';
import { BusinessLogo } from '../../src/components/BusinessLogo';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { DetailRow } from '../../src/components/DetailRow';
import { ExplorerLinkRow } from '../../src/components/ExplorerLinkRow';
import { EmptyState } from '../../src/components/EmptyState';
import { SkeletonLoader } from '../../src/components/SkeletonLoader';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { usePublicReceipt } from '../../src/services/publicDocuments/usePublicReceipt';
import type { PublicReceiptData, PublicReceiptPayment } from '../../src/services/publicDocuments/types';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatDocumentDate } from '../../src/utils/formatDocumentDate';
import { getReceiptId } from '../../src/utils/documentIds';
import { truncateHash } from '../../src/utils/truncateHash';
import { getPublicReceiptUrl } from '../../src/utils/publicReceiptLink';

const MAX_CONTENT_WIDTH = 480;

// No AuthGate, no authenticated store reads -- see app/receipt/_layout.tsx.
// Fetches once via get_public_invoice + get_public_receipt (composed in
// receiptService.ts), refetching on focus + pull-to-refresh -- same
// read-once pattern as the invoice/portal pages, no polling.
export default function PublicReceiptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors, spacing } = useTheme();
  const { result, isRefreshing, refresh } = usePublicReceipt(token);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <Head>
        <title>Spero — Receipt</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Spero" />
        <meta property="og:description" content="Payment receipt" />
      </Head>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        <View style={[styles.content, { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl }]}>
          {result === null ? (
            <DocumentSkeleton />
          ) : !result.ok ? (
            <DocumentErrorState code={result.code} onRetry={refresh} />
          ) : (
            <ReceiptContent data={result.data} token={token ?? ''} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DocumentSkeleton() {
  const { spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <SkeletonLoader width={40} height={40} style={{ borderRadius: radius.md }} />
        <SkeletonLoader width="40%" height={16} />
      </View>
      <SkeletonLoader width="100%" height={140} style={{ marginTop: spacing.xl, borderRadius: radius.lg }} />
      <SkeletonLoader width="100%" height={180} style={{ borderRadius: radius.lg }} />
    </View>
  );
}

function DocumentErrorState({ code, onRetry }: { code: 'invalid_token' | 'not_found' | 'network_error'; onRetry: () => void }) {
  const { spacing } = useTheme();

  if (code === 'network_error') {
    return (
      <View style={{ marginTop: spacing.xxl }}>
        <EmptyState
          icon="cloud-offline-outline"
          title="We couldn't load this receipt"
          description="Check your connection and try again."
        />
        <View style={{ marginTop: spacing.lg }}>
          <SecondaryButton label="Try Again" onPress={onRetry} />
        </View>
      </View>
    );
  }

  if (code === 'invalid_token') {
    return (
      <View style={{ marginTop: spacing.xxl }}>
        <EmptyState
          icon="alert-circle-outline"
          title="This link isn't valid"
          description="Double-check the link, or ask the business to resend it."
        />
      </View>
    );
  }

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <EmptyState
        icon="receipt-outline"
        title="This receipt is no longer available"
        description="Please contact the business for an up-to-date link."
      />
    </View>
  );
}

function ReceiptContent({ data, token }: { data: PublicReceiptData; token: string }) {
  const { colors, spacing, radius, typography } = useTheme();
  const receiptId = getReceiptId(data.paymentCode);
  const businessName = data.merchantName?.trim() || 'the business';
  const hasPayments = data.payments.length > 0;
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const copiedHashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedShareTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedHashTimeout.current) clearTimeout(copiedHashTimeout.current);
      if (copiedShareTimeout.current) clearTimeout(copiedShareTimeout.current);
    },
    []
  );

  async function handleShare() {
    const message = `Payment Receipt ${receiptId}\n\n${data.verifiedPaidAmount} ${data.currency} received${data.description ? ` for ${data.description}` : ''}.\n\nView receipt:\n${getPublicReceiptUrl(token)}`;
    try {
      await Share.share({ message });
    } catch {
      // See app/invoice/[token].tsx's identical comment -- react-native-web
      // has no Web Share API fallback on most browsers. Same inline
      // "Copied" confirmation as the hash-copy action below, not a silent
      // clipboard write with no feedback.
      await Clipboard.setStringAsync(message);
      setCopiedShare(true);
      if (copiedShareTimeout.current) clearTimeout(copiedShareTimeout.current);
      copiedShareTimeout.current = setTimeout(() => setCopiedShare(false), 2000);
    }
  }

  async function handleCopyHash(hash: string) {
    await Clipboard.setStringAsync(hash);
    setCopiedHash(hash);
    if (copiedHashTimeout.current) clearTimeout(copiedHashTimeout.current);
    copiedHashTimeout.current = setTimeout(() => setCopiedHash((current) => (current === hash ? null : current)), 2000);
  }

  return (
    <View>
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
          <Ionicons name={hasPayments ? 'checkmark' : 'time-outline'} size={26} color={colors.primaryAction} />
        </View>
        <Text style={[typography.h3, { color: colors.heroSurfaceText, marginTop: spacing.md }]}>
          {hasPayments ? 'Payment Received' : 'Awaiting Payment'}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted, marginTop: spacing.xs / 2 }]}>
          Verified on {data.network}
        </Text>
        <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.lg }]}>
          {formatCurrency(hasPayments ? data.verifiedPaidAmount : data.totalAmount)} {data.currency}
        </Text>
        {hasPayments && data.remainingAmount > 0 ? (
          <Text style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted, marginTop: spacing.xs }]}>
            {formatCurrency(data.remainingAmount)} {data.currency} still due
          </Text>
        ) : null}
      </ThemeAwareCard>

      <ThemeAwareCard style={{ marginTop: spacing.lg, padding: spacing.xl }}>
        <View style={[styles.docHeaderRow, { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Receipt ID</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{receiptId}</Text>
          </View>
          {hasPayments ? (
            <View style={[styles.verifiedPill, { backgroundColor: colors.softMint, borderRadius: radius.full, paddingHorizontal: spacing.sm }]}>
              <Ionicons name="shield-checkmark" size={12} color={colors.softMintText} />
              <Text style={[typography.caption, { color: colors.softMintText, marginLeft: spacing.xs / 2 }]}>Verified</Text>
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: spacing.md }}>
          {data.merchantLogoUrl ? (
            <View style={[styles.merchantRow, { marginBottom: spacing.md }]}>
              <BusinessLogo name={businessName} logoUrl={data.merchantLogoUrl} size={28} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Merchant</Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                  {businessName}
                </Text>
              </View>
            </View>
          ) : (
            <DetailRow label="Merchant" value={businessName} />
          )}
          {data.customerName ? <DetailRow label="Customer" value={data.customerName} /> : null}
          {data.description ? <DetailRow label="Description" value={data.description} /> : null}
          <DetailRow label="Network" value={data.network} last />
        </View>
      </ThemeAwareCard>

      {hasPayments ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Text style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.4 }]}>
            {data.payments.length > 1 ? `${data.payments.length} PAYMENTS` : 'PAYMENT'}
          </Text>
          {data.payments.map((payment, index) => (
            <PaymentLine
              key={payment.txHash}
              payment={payment}
              index={index}
              copied={copiedHash === payment.txHash}
              onCopyHash={handleCopyHash}
            />
          ))}
        </View>
      ) : (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState
            icon="hourglass-outline"
            title="No payments yet"
            description="This receipt will update automatically once a payment is verified."
          />
        </View>
      )}

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <SecondaryButton
          label={copiedShare ? 'Copied' : 'Share Receipt'}
          icon={copiedShare ? 'checkmark' : 'share-outline'}
          onPress={handleShare}
        />
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Powered by Spero</Text>
      </View>
    </View>
  );
}

function PaymentLine({
  payment,
  index,
  copied,
  onCopyHash,
}: {
  payment: PublicReceiptPayment;
  index: number;
  copied: boolean;
  onCopyHash: (hash: string) => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <ThemeAwareCard>
      <View style={styles.docHeaderRow}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Payment {index + 1}</Text>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
          {formatCurrency(payment.amount)} {payment.currency}
        </Text>
      </View>
      <DetailRow label="Paid Date" value={formatDocumentDate(payment.paidAt)} />
      <DetailRow label="Transaction" value={truncateHash(payment.txHash)} />
      <ExplorerLinkRow txHash={payment.txHash} last />
      <View style={{ marginTop: spacing.md }}>
        <SecondaryButton
          label={copied ? 'Copied' : 'Copy Transaction Hash'}
          icon={copied ? 'checkmark' : 'copy-outline'}
          onPress={() => onCopyHash(payment.txHash)}
        />
      </View>
    </ThemeAwareCard>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  checkCircle: { alignItems: 'center', justifyContent: 'center' },
  docHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  merchantRow: { flexDirection: 'row', alignItems: 'center' },
});
