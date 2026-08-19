import { View, Text, ScrollView, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { Logo } from '../../src/components/Logo';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useProfileStore } from '../../src/store/profileStore';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatDocumentDate } from '../../src/utils/formatDocumentDate';
import { getInvoiceId } from '../../src/utils/documentIds';
import { buildInvoiceShareMessage } from '../../src/utils/buildInvoiceShareMessage';

export default function InvoiceScreen() {
  const { colors, spacing, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const profile = useProfileStore((state) => state.profile);

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
  const businessName = profile.businessName?.trim() || profile.displayName || 'Your business';

  async function handleShare() {
    if (!request) return;
    await Share.share({ message: buildInvoiceShareMessage(request, profile) });
  }

  async function handleCopyLink() {
    if (!request) return;
    await Clipboard.setStringAsync(request.paymentLink);
    Alert.alert('Copied', 'Payment link copied to clipboard.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Invoice" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Logo size={48} />
          <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.md }]}>SperoPay</Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>Invoice</Text>
        </View>

        <ThemeAwareCard>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Invoice ID</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{invoiceId}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>From</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{businessName}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>To</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {customer?.name ?? 'No customer'}
            </Text>
          </View>
          {customer?.email ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Email</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{customer.email}</Text>
            </View>
          ) : null}
          {request.description ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Service</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {request.description}
              </Text>
            </View>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Amount</Text>
            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.amount} {request.currency}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
              Display Value: {formatCurrency(request.amount)}
            </Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Network</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{request.network}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Issue Date</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {formatDocumentDate(request.createdAt)}
            </Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Due / Expiry</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.expiresAt ? formatDocumentDate(request.expiresAt) : 'No expiry'}
            </Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Status</Text>
            <View style={{ marginTop: spacing.xs / 2 }}>
              <StatusBadge status={request.status} />
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Payment Request</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.paymentCode}
            </Text>
          </View>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="Share Invoice" onPress={handleShare} />
          <SecondaryButton label="Copy Payment Link" onPress={handleCopyLink} />
          <SecondaryButton label="View Payment Request" onPress={() => router.push(`/pay/${request.id}`)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
