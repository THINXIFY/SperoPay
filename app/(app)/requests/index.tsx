import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { RequestCard } from '../../../src/components/RequestCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import type { PaymentRequest, PaymentRequestStatus } from '../../../src/types';

type Filter = 'all' | PaymentRequestStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
];

function getDateLabel(request: PaymentRequest): string {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (request.status === 'paid') return `Paid on ${formatDate(request.createdAt)}`;
  if (request.status === 'expired') return `Expired on ${request.expiresAt ? formatDate(request.expiresAt) : formatDate(request.createdAt)}`;
  if (!request.expiresAt) return 'No expiry';

  const daysLeft = Math.ceil((new Date(request.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return daysLeft <= 0 ? 'Expires today' : `Expires in ${daysLeft}d`;
}

export default function RequestsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const requests = useRequestStore((state) => state.requests);
  const customers = useCustomerStore((state) => state.customers);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const sorted = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filter === 'all' ? sorted : sorted.filter((r) => r.status === filter);
  }, [requests, filter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>Requests</Text>
        <View style={[styles.filterRow, { marginTop: spacing.lg, gap: spacing.sm }]}>
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
          <EmptyState
            icon="document-text-outline"
            title="No requests yet"
            description="Requests you create will show up here."
          />
        }
        renderItem={({ item }) => {
          const customer = customers.find((c) => c.id === item.customerId);
          return (
            <RequestCard
              title={customer?.name ?? 'No customer'}
              description={item.description}
              amount={item.amount}
              currency={item.currency}
              status={item.status}
              dateLabel={getDateLabel(item)}
              onPress={() => router.push(`/(app)/requests/${item.id}`)}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row' },
  filterChip: { paddingVertical: 8, borderWidth: 1 },
});
