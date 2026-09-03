import { View, Text, ScrollView, Alert, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { Logo } from '../../src/components/Logo';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatDocumentDate } from '../../src/utils/formatDocumentDate';
import { getReceiptId } from '../../src/utils/documentIds';
import { buildReceiptShareMessage } from '../../src/utils/buildReceiptShareMessage';
import { truncateHash } from '../../src/utils/truncateHash';

export default function ReceiptScreen() {
  const { colors, spacing, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const profile = useProfileStore((state) => state.profile);
  const transaction = useTransactionStore((state) => (request ? state.getTransactionForRequest(request.id) : undefined));

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
    Alert.alert('Copied', 'Transaction hash copied to clipboard.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Receipt" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Logo size={48} />
          <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.md }]}>SperoPay</Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
            Payment Receipt
          </Text>
        </View>

        <ThemeAwareCard variant="hero">
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Amount</Text>
          <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>
            {request.amount} {request.currency}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs }]}>
            Display Value: {formatCurrency(request.amount)}
          </Text>
        </ThemeAwareCard>

        <ThemeAwareCard style={{ marginTop: spacing.lg }}>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Receipt ID</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{receiptId}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Merchant</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{businessName}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Customer</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {customer?.name ?? 'No customer'}
            </Text>
          </View>
          {request.description ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Description</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {request.description}
              </Text>
            </View>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Network</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{request.network}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Status</Text>
            <Text style={[typography.bodyMedium, { color: colors.success, marginTop: spacing.xs / 2 }]}>Paid</Text>
          </View>
          {transaction ? (
            <>
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Paid Date</Text>
                <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                  {formatDocumentDate(transaction.paidAt)}
                </Text>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Transaction</Text>
                <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                  {truncateHash(transaction.txHash)}
                </Text>
              </View>
            </>
          ) : (
            // The request's own status already says paid -- a real payment
            // is verified and its transaction row written atomically, so
            // this only ever happens for a moment right after this screen's
            // own store data was fetched. A brief note, not an error state.
            <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginLeft: spacing.sm }]}>
                Syncing transaction details…
              </Text>
            </View>
          )}
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="Share Receipt" onPress={handleShare} />
          {transaction ? <SecondaryButton label="View Transaction" onPress={handleViewTransaction} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
