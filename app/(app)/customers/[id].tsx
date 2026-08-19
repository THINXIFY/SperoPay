import { useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { RequestCard } from '../../../src/components/RequestCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestStore } from '../../../src/store/requestStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { getCustomerStats } from '../../../src/utils/getCustomerStats';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import type { PaymentRequest } from '../../../src/types';

function getDateLabel(request: PaymentRequest): string {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (request.status === 'paid') return `Paid on ${formatDate(request.createdAt)}`;
  if (request.status === 'cancelled') return 'Cancelled';
  if (request.status === 'expired') return `Expired on ${request.expiresAt ? formatDate(request.expiresAt) : formatDate(request.createdAt)}`;
  return `Requested ${formatDate(request.createdAt)}`;
}

export default function CustomerDetailScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === id));
  const requests = useRequestStore((state) => state.requests);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);

  const history = useMemo(
    () =>
      requests
        .filter((r) => r.customerId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [requests, id]
  );

  if (!customer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Customer" onBackPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const stats = getCustomerStats(customer.id, requests);
  const customerId = customer.id;

  function handleRequestPayment() {
    prefillDraft({ customerId });
    router.push('/request/amount');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Customer" onBackPress={() => router.back()} />
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.xl }}>
            <View style={styles.headerRow}>
              <CustomerAvatar name={customer.name} color={customer.avatarColor} size={56} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>{customer.name}</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{customer.email}</Text>
                {customer.company ? (
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{customer.company}</Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.statsRow, { marginTop: spacing.xl, gap: spacing.md }]}>
              <ThemeAwareCard style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Total Received</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  {formatCurrency(stats.totalReceived)}
                </Text>
              </ThemeAwareCard>
              <ThemeAwareCard style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Payments</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  {stats.totalRequests}
                </Text>
              </ThemeAwareCard>
              <ThemeAwareCard style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Outstanding</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  {formatCurrency(stats.outstanding)}
                </Text>
              </ThemeAwareCard>
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <PrimaryButton label="Request Payment" onPress={handleRequestPayment} />
            </View>

            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
              HISTORY
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="document-text-outline" title="No requests yet" description="Requests sent to this customer will show up here." />
        }
        renderItem={({ item }) => (
          <RequestCard
            title={item.description || item.paymentCode}
            amount={item.amount}
            currency={item.currency}
            status={item.status}
            dateLabel={getDateLabel(item)}
            onPress={() => router.push(`/(app)/requests/${item.id}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row' },
});
