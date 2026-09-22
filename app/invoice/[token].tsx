import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useTheme } from '../../src/theme/useTheme';
import { Logo } from '../../src/components/Logo';
import { BusinessLogo } from '../../src/components/BusinessLogo';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { DetailRow } from '../../src/components/DetailRow';
import { CustomerFacingStatusPill } from '../../src/components/CustomerFacingStatusPill';
import { EmptyState } from '../../src/components/EmptyState';
import { SkeletonLoader } from '../../src/components/SkeletonLoader';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { usePublicInvoice } from '../../src/services/publicDocuments/usePublicInvoice';
import type { PublicInvoiceData } from '../../src/services/publicDocuments/types';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatDocumentDate } from '../../src/utils/formatDocumentDate';
import { getInvoiceId } from '../../src/utils/documentIds';
import { getPublicPaymentUrl } from '../../src/utils/publicPaymentLink';
import { getPublicInvoiceUrl } from '../../src/utils/publicInvoiceLink';

const MAX_CONTENT_WIDTH = 480;

// No AuthGate, no authenticated store reads -- see app/invoice/_layout.tsx.
// Fetches once via get_public_invoice, refetching on focus + pull-to-
// refresh (usePublicInvoice), the same read pattern as app/c/[token].tsx --
// an invoice has nothing that needs live polling, unlike /p/[token]'s
// payment-status watch.
export default function PublicInvoiceScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors, spacing } = useTheme();
  const { result, isRefreshing, refresh } = usePublicInvoice(token);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      {/* Same reasoning as the public checkout/portal pages' identical
          block -- generic, non-identifying metadata only, never indexed. */}
      <Head>
        <title>Spero — Invoice</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Spero" />
        <meta property="og:description" content="Invoice" />
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
            <InvoiceContent data={result.data} token={token ?? ''} />
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
      <SkeletonLoader width="100%" height={280} style={{ marginTop: spacing.xl, borderRadius: radius.lg }} />
    </View>
  );
}

// Same 3-code distinction as app/p/[token].tsx and app/c/[token].tsx: a
// malformed link (never valid) reads differently from one that's
// expired/no-longer-available (was valid once), which reads differently
// from a transient network problem -- only network_error gets a retry.
function DocumentErrorState({ code, onRetry }: { code: 'invalid_token' | 'not_found' | 'network_error'; onRetry: () => void }) {
  const { spacing } = useTheme();

  if (code === 'network_error') {
    return (
      <View style={{ marginTop: spacing.xxl }}>
        <EmptyState
          icon="cloud-offline-outline"
          title="We couldn't load this invoice"
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
        icon="document-text-outline"
        title="This invoice is no longer available"
        description="Please contact the business for an up-to-date link."
      />
    </View>
  );
}

function InvoiceContent({ data, token }: { data: PublicInvoiceData; token: string }) {
  const { colors, spacing, typography } = useTheme();
  const invoiceId = getInvoiceId(data.paymentCode);
  const businessName = data.merchantName?.trim() || 'the business';
  // Tracks WHICH link was last copied (payment vs. invoice), not just
  // whether something was -- these are two distinct, independently useful
  // links (getPublicInvoiceUrl was otherwise dead code, never referenced
  // by any screen), so a bare boolean would let one button's "Copied"
  // state bleed into the other's label.
  const [copiedField, setCopiedField] = useState<'payment' | 'invoice' | null>(null);
  const copiedFieldTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedFieldTimeout.current) clearTimeout(copiedFieldTimeout.current);
  }, []);

  const isPartial = data.allowPartialPayments && data.verifiedPaidAmount > 0 && data.remainingAmount > 0;

  function showCopied(field: 'payment' | 'invoice') {
    setCopiedField(field);
    if (copiedFieldTimeout.current) clearTimeout(copiedFieldTimeout.current);
    copiedFieldTimeout.current = setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 2000);
  }

  async function handleShare() {
    const message = `Invoice ${invoiceId}\n\n${businessName} requested ${data.amount} ${data.currency}${data.description ? ` for ${data.description}` : ''}.\n\nView invoice:\n${getPublicInvoiceUrl(token)}\n\nPay with Spero:\n${getPublicPaymentUrl(token)}`;
    try {
      await Share.share({ message });
    } catch {
      // No native/Web Share support (e.g. a desktop browser) -- react-native-
      // web's Share.share rejects rather than opening anything. Fall back to
      // copying the same message so the action still does something useful,
      // reusing the exact "Copied" inline-state pattern below rather than
      // Alert.alert, which is a silent no-op on react-native-web.
      await Clipboard.setStringAsync(message);
      showCopied('invoice');
    }
  }

  async function handleCopyPaymentLink() {
    await Clipboard.setStringAsync(getPublicPaymentUrl(token));
    showCopied('payment');
  }

  async function handleCopyInvoiceLink() {
    await Clipboard.setStringAsync(getPublicInvoiceUrl(token));
    showCopied('invoice');
  }

  return (
    <View>
      <ThemeAwareCard style={{ padding: spacing.xl }}>
        <View style={[styles.docHeaderRow, { paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <View style={styles.docHeaderRow}>
            <Logo size={36} />
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>SperoPay</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{invoiceId}</Text>
            </View>
          </View>
          <CustomerFacingStatusPill
            status={data.status}
            dueAt={data.dueAt}
            verifiedPaidAmount={data.verifiedPaidAmount}
            remainingAmount={data.remainingAmount}
          />
        </View>

        <View style={[styles.partiesRow, { marginTop: spacing.lg, gap: spacing.base }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.4 }]}>FROM</Text>
            <View style={[styles.billToRow, { marginTop: spacing.xs / 2 }]}>
              {data.merchantLogoUrl ? <BusinessLogo name={businessName} logoUrl={data.merchantLogoUrl} size={20} /> : null}
              <View style={{ flex: 1, marginLeft: data.merchantLogoUrl ? spacing.xs : 0 }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={2}>
                  {businessName}
                </Text>
              </View>
            </View>
          </View>
          {data.customerName ? (
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.4 }]}>BILL TO</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                {data.customerName}
              </Text>
            </View>
          ) : null}
        </View>

        {data.description ? (
          <View
            style={[
              styles.serviceRow,
              { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
            ]}
          >
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{data.description}</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.md }]}>
              {formatCurrency(data.amount)}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.totalRow,
            { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
          ]}
        >
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Total</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[typography.h2, { color: colors.textPrimary }]}>
              {formatCurrency(data.amount)} {data.currency}
            </Text>
          </View>
        </View>

        {/* Partial-payment accounting -- only shown when it's actually
            informative (spec: never show "Paid/Remaining" on a plain,
            never-partial request). Mirrors the same allow_partial_payments
            gate get_public_payment_request's checkout page already uses. */}
        {isPartial ? (
          <View style={{ marginTop: spacing.sm }}>
            <DetailRow label="Paid so far" value={`${formatCurrency(data.verifiedPaidAmount)} ${data.currency}`} />
            <DetailRow label="Balance due" value={`${formatCurrency(data.remainingAmount)} ${data.currency}`} last />
          </View>
        ) : null}

        <View style={{ marginTop: spacing.lg }}>
          <DetailRow label="Network" value={data.network} />
          <DetailRow label="Issue Date" value={formatDocumentDate(data.createdAt)} />
          {data.dueAt ? <DetailRow label="Due" value={formatDocumentDate(data.dueAt)} /> : null}
          <DetailRow label="Expiry" value={data.expiresAt ? formatDocumentDate(data.expiresAt) : 'No expiry'} />
          <DetailRow label="Payment Request" value={data.paymentCode} last />
        </View>
      </ThemeAwareCard>

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <SecondaryButton label={copiedField === 'invoice' ? 'Copied' : 'Share Invoice'} icon={copiedField === 'invoice' ? 'checkmark' : 'share-outline'} onPress={handleShare} />
        <SecondaryButton
          label={copiedField === 'payment' ? 'Link Copied' : 'Copy Payment Link'}
          icon={copiedField === 'payment' ? 'checkmark' : 'link-outline'}
          onPress={handleCopyPaymentLink}
        />
        <SecondaryButton
          label={copiedField === 'invoice' ? 'Link Copied' : 'Copy Invoice Link'}
          icon={copiedField === 'invoice' ? 'checkmark' : 'document-text-outline'}
          onPress={handleCopyInvoiceLink}
        />
        <SecondaryButton label="View Payment Request" onPress={() => router.push(`/p/${token}`)} />
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Powered by Spero</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  docHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partiesRow: { flexDirection: 'row' },
  billToRow: { flexDirection: 'row', alignItems: 'center' },
  serviceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
