import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { RequestCard } from '../../../src/components/RequestCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { SkeletonLoader } from '../../../src/components/SkeletonLoader';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useTransactionStore } from '../../../src/store/transactionStore';
import { getDateLabel } from '../../../src/utils/getDateLabel';
import type { PaymentRequest, PaymentRequestStatus } from '../../../src/types';

type Filter = 'all' | PaymentRequestStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirming', label: 'Confirming' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function RequestsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const requests = useRequestStore((state) => state.requests);
  const status = useRequestStore((state) => state.status);
  const error = useRequestStore((state) => state.error);
  const customers = useCustomerStore((state) => state.customers);
  const transactions = useTransactionStore((state) => state.transactions);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const sorted = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const byStatus = filter === 'all' ? sorted : sorted.filter((r) => r.status === filter);

    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.length === 0) return byStatus;

    return byStatus.filter((r) => {
      const customer = customers.find((c) => c.id === r.customerId);
      const haystacks = [
        customer?.name,
        r.description,
        r.paymentCode,
        String(r.amount),
      ];
      return haystacks.some((value) => value?.toLowerCase().includes(trimmedQuery));
    });
  }, [requests, customers, filter, query]);

  // Precomputed once instead of customers.find(...)/transactions.find(...)
  // running fresh inside renderItem for every visible row on every render.
  const customerById = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    for (const customer of customers) map.set(customer.id, customer);
    return map;
  }, [customers]);

  const transactionByRequestId = useMemo(() => {
    const map = new Map<string, (typeof transactions)[number]>();
    for (const transaction of transactions) map.set(transaction.requestId, transaction);
    return map;
  }, [transactions]);

  const handleRequestPress = useCallback((id: string) => {
    router.push(`/(app)/requests/${id}`);
  }, []);

  const renderRequestRow = useCallback(
    ({ item }: { item: PaymentRequest }) => {
      const customer = customerById.get(item.customerId ?? '');
      const transaction = transactionByRequestId.get(item.id);
      return (
        <RequestCard
          id={item.id}
          title={customer?.name ?? 'No customer'}
          description={item.description}
          amount={item.amount}
          currency={item.currency}
          status={item.status}
          dateLabel={getDateLabel(item, transaction)}
          onPress={handleRequestPress}
        />
      );
    },
    [customerById, transactionByRequestId, handleRequestPress]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>Requests</Text>

        <View
          style={[
            styles.searchRow,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.base },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search customer, description, ID, or amount"
            placeholderTextColor={colors.textMuted}
            style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}
            accessibilityLabel="Search requests"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.filterRow, { marginTop: spacing.base, gap: spacing.sm }]}>
          {FILTERS.map((item) => {
            const isActive = filter === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setFilter(item.value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? colors.heroSurface : colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.bodySmall, { color: isActive ? colors.heroSurfaceText : colors.textSecondary }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListEmptyComponent={
          status === 'loading' ? (
            <View style={{ gap: spacing.md }}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.lg,
                    padding: spacing.base,
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <SkeletonLoader width="40%" height={16} />
                    <SkeletonLoader width={70} height={16} />
                  </View>
                  <SkeletonLoader width="55%" height={12} />
                </View>
              ))}
            </View>
          ) : status === 'error' ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Couldn't load requests"
              description={error ?? 'Something went wrong. Try again.'}
            />
          ) : (
            <EmptyState
              icon="document-text-outline"
              title={query.length > 0 ? 'No matching requests' : 'No requests yet'}
              description={
                query.length > 0
                  ? 'Try a different search term or filter.'
                  : 'Create your first payment request and share it with a customer.'
              }
            />
          )
        }
        renderItem={renderRequestRow}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, paddingHorizontal: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap' },
  filterChip: { paddingVertical: 8, borderWidth: 1 },
});
