import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { DetailRow } from '../../src/components/DetailRow';
import { CustomerAvatar } from '../../src/components/CustomerAvatar';
import { BusinessLogo } from '../../src/components/BusinessLogo';
import { Logo } from '../../src/components/Logo';
import { EmptyState } from '../../src/components/EmptyState';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useRefreshMerchantPaymentData } from '../../src/store/useRefreshMerchantPaymentData';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatDocumentDate } from '../../src/utils/formatDocumentDate';
import { getInvoiceId } from '../../src/utils/documentIds';
import { buildInvoiceShareMessage } from '../../src/utils/buildInvoiceShareMessage';
import { getPublicPaymentUrl } from '../../src/utils/publicPaymentLink';

export default function InvoiceScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const profile = useProfileStore((state) => state.profile);
  const [copiedLink, setCopiedLink] = useState(false);
  const copiedLinkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedLinkTimeout.current) clearTimeout(copiedLinkTimeout.current);
  }, []);
  const { refresh: refreshPaymentData, isRefreshing } = useRefreshMerchantPaymentData();

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Invoice" onBackPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="document-text-outline"
            title="We couldn't load this invoice."
            description="This invoice is no longer available."
          />
        </View>
      </SafeAreaView>
    );
  }

  const invoiceId = getInvoiceId(request);
  const businessName = profile?.businessName?.trim() || profile?.displayName || 'Your business';

  async function handleShare() {
    if (!request || !profile) return;
    await Share.share({ message: buildInvoiceShareMessage(request, profile) });
  }

  async function handleCopyLink() {
    if (!request) return;
    await Clipboard.setStringAsync(getPublicPaymentUrl(request.publicToken));
    setCopiedLink(true);
    if (copiedLinkTimeout.current) clearTimeout(copiedLinkTimeout.current);
    copiedLinkTimeout.current = setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Invoice" onBackPress={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refreshPaymentData} />}
      >
        <ThemeAwareCard style={{ padding: spacing.xl }}>
          <View style={[styles.docHeaderRow, { paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={styles.docHeaderRow}>
              <Logo size={36} />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>SperoPay</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{invoiceId}</Text>
              </View>
            </View>
            <StatusBadge status={request.status} />
          </View>

          <View style={[styles.partiesRow, { marginTop: spacing.lg, gap: spacing.base }]}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.4 }]}>FROM</Text>
              <View style={[styles.billToRow, { marginTop: spacing.xs / 2 }]}>
                {profile?.businessLogoUri ? (
                  <BusinessLogo name={businessName} logoUrl={profile.businessLogoUri} size={20} />
                ) : null}
                <View style={{ flex: 1, marginLeft: profile?.businessLogoUri ? spacing.xs : 0 }}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={2}>
                    {businessName}
                  </Text>
                </View>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.4 }]}>BILL TO</Text>
              <View style={[styles.billToRow, { marginTop: spacing.xs / 2 }]}>
                {customer ? (
                  <CustomerAvatar
                    name={customer.name}
                    color={customer.avatarColor}
                    avatarUrl={customer.avatarUrl}
                    imageType={customer.imageType}
                    size={20}
                  />
                ) : null}
                <View style={{ flex: 1, marginLeft: customer ? spacing.xs : 0 }}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                    {customer?.name ?? 'No customer'}
                  </Text>
                </View>
              </View>
              {customer?.email ? (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                  {customer.email}
                </Text>
              ) : null}
            </View>
          </View>

          {request.description ? (
            <View
              style={[
                styles.serviceRow,
                { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{request.description}</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.md }]}>
                {formatCurrency(request.amount)}
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
                {request.amount} {request.currency}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                ≈ {formatCurrency(request.amount)}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <DetailRow label="Network" value={request.network} />
            <DetailRow label="Issue Date" value={formatDocumentDate(request.createdAt)} />
            <DetailRow label="Due / Expiry" value={request.expiresAt ? formatDocumentDate(request.expiresAt) : 'No expiry'} />
            <DetailRow label="Payment Request" value={request.paymentCode} last />
          </View>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="Share Invoice" icon="share-outline" onPress={handleShare} />
          <SecondaryButton
            label={copiedLink ? 'Link Copied' : 'Copy Payment Link'}
            icon={copiedLink ? 'checkmark' : 'link-outline'}
            onPress={handleCopyLink}
          />
          <SecondaryButton label="View Payment Request" onPress={() => router.push(`/pay/${request.id}`)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  docHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partiesRow: { flexDirection: 'row' },
  billToRow: { flexDirection: 'row', alignItems: 'center' },
  serviceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
