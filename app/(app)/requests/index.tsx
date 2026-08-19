import { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { RequestCard } from '../../../src/components/RequestCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import { getDateLabel } from '../../../src/utils/getDateLabel';
import type { PaymentRequestStatus } from '../../../src/types';

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
  const customers = useCustomerStore((state) => state.customers);
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
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search">
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
          <EmptyState
            icon="document-text-outline"
            title={query.length > 0 ? 'No matching requests' : 'No requests yet'}
            description={
              query.length > 0
                ? 'Try a different search term or filter.'
                : 'Create your first payment request and share it with a customer.'
            }
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
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, paddingHorizontal: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap' },
  filterChip: { paddingVertical: 8, borderWidth: 1 },
});
