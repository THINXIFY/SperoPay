import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { EmptyState } from '../../../src/components/EmptyState';
import { SkeletonLoader } from '../../../src/components/SkeletonLoader';
import { AppRefreshControl } from '../../../src/components/AppRefreshControl';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useTransactionStore } from '../../../src/store/transactionStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../../../src/store/paymentDefaultsStore';
import { useRefreshMerchantPaymentData } from '../../../src/store/useRefreshMerchantPaymentData';
import { getDateLabel } from '../../../src/utils/getDateLabel';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import type { Customer, PaymentRequest, PaymentRequestStatus, Transaction } from '../../../src/types';

type Filter = 'all' | PaymentRequestStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirming', label: 'Confirming' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface RequestRowProps {
  customer?: Customer;
  request: PaymentRequest;
  dateLabel: string;
  onPress: (id: string) => void;
}

// A bespoke row for this list only -- deliberately not a change to the
// shared RequestCard (also used by Customer Detail's history) or
// StatusBadge, so this redesign stays scoped to the Requests screen and
// never ripples into an unrelated one.
//
// React.memo still pays off here even though renderRequestRow recomputes
// `customer` and `dateLabel` on every call: `customer` comes from a Map
// keyed off the memoized customerById (same object reference as long as
// `customers` itself hasn't changed), and `dateLabel` is a primitive --
// two separately computed calls that produce the same string still
// compare equal under shallow prop comparison. Only `request` itself
// (unchanged unless that row's data changed) and the stable
// `handleRequestPress` need to hold for the skip to actually happen.
const RequestRow = React.memo(function RequestRow({ customer, request, dateLabel, onPress }: RequestRowProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const secondaryLine = request.description || request.paymentCode;

  return (
    <Pressable
      onPress={() => onPress(request.id)}
      accessibilityRole="button"
      accessibilityLabel={`${customer?.name ?? 'No customer'}, ${formatCurrency(request.amount)} ${request.currency}, ${request.status}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.base,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={styles.topRow}>
        <CustomerAvatar
          name={customer?.name ?? '?'}
          color={customer?.avatarColor ?? 'blue'}
          avatarUrl={customer?.avatarUrl}
          imageType={customer?.imageType}
          size={36}
        />
        <View style={{ marginLeft: spacing.sm, flex: 1 }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
            {customer?.name ?? 'No customer'}
          </Text>
          {secondaryLine ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
              {secondaryLine}
            </Text>
          ) : null}
        </View>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm }]} numberOfLines={1}>
          {formatCurrency(request.amount)} {request.currency}
        </Text>
      </View>
      <View style={[styles.footerRow, { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }]}>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {dateLabel}
        </Text>
        <StatusBadge status={request.status} />
      </View>
    </Pressable>
  );
});

export default function RequestsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const requests = useRequestStore((state) => state.requests);
  const status = useRequestStore((state) => state.status);
  const error = useRequestStore((state) => state.error);
  const customers = useCustomerStore((state) => state.customers);
  const transactions = useTransactionStore((state) => state.transactions);
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { refresh: refreshPaymentData, isRefreshing } = useRefreshMerchantPaymentData();

  const filtered = useMemo(() => {
    const sorted = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const byStatus = filter === 'all' ? sorted : sorted.filter((r) => r.status === filter);

    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.length === 0) return byStatus;

    return byStatus.filter((r) => {
      const customer = customers.find((c) => c.id === r.customerId);
      const haystacks = [customer?.name, r.description, r.paymentCode, String(r.amount)];
      return haystacks.some((value) => value?.toLowerCase().includes(trimmedQuery));
    });
  }, [requests, customers, filter, query]);

  // Precomputed once instead of customers.find(...)/transactions.find(...)
  // running fresh inside renderItem for every visible row on every render.
  const customerById = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const customer of customers) map.set(customer.id, customer);
    return map;
  }, [customers]);

  const transactionByRequestId = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const transaction of transactions) map.set(transaction.requestId, transaction);
    return map;
  }, [transactions]);

  const handleRequestPress = useCallback((id: string) => {
    router.push(`/(app)/requests/${id}`);
  }, []);

  function handleCreateRequest() {
    startFresh(defaultExpiryOption);
    router.push('/request/amount');
  }

  const renderRequestRow = useCallback(
    ({ item }: { item: PaymentRequest }) => (
      <RequestRow
        customer={customerById.get(item.customerId ?? '')}
        request={item}
        dateLabel={getDateLabel(item, transactionByRequestId.get(item.id))}
        onPress={handleRequestPress}
      />
    ),
    [customerById, transactionByRequestId, handleRequestPress]
  );

  const activeFilterLabel = FILTERS.find((f) => f.value === filter)?.label ?? 'All';
  const summaryLabel =
    status === 'loaded'
      ? `${filtered.length} ${filtered.length === 1 ? 'request' : 'requests'}${filter !== 'all' ? ` · ${activeFilterLabel}` : ''}`
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>Requests</Text>
        {summaryLabel ? (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
            {summaryLabel}
          </Text>
        ) : null}

        <View
          style={[
            styles.searchRow,
            {
              backgroundColor: colors.surface,
              borderColor: isSearchFocused ? colors.textPrimary : colors.border,
              borderRadius: radius.md,
              marginTop: spacing.base,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search requests"
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
                accessibilityRole="button"
                accessibilityLabel={`Filter: ${item.label}`}
                accessibilityState={{ selected: isActive }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? colors.heroSurface : colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
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
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refreshPaymentData} />}
        ListEmptyComponent={
          status === 'loading' ? (
            <View style={{ gap: spacing.sm }}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.lg,
                    padding: spacing.base,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <SkeletonLoader width={36} height={36} style={{ borderRadius: radius.full }} />
                    <View style={{ marginLeft: spacing.sm, flex: 1, gap: spacing.xs }}>
                      <SkeletonLoader width="45%" height={14} />
                      <SkeletonLoader width="30%" height={11} />
                    </View>
                    <SkeletonLoader width={50} height={14} />
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginTop: spacing.sm,
                      paddingTop: spacing.sm,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <SkeletonLoader width={70} height={11} />
                    <SkeletonLoader width={60} height={18} style={{ borderRadius: radius.full }} />
                  </View>
                </View>
              ))}
            </View>
          ) : status === 'error' ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Couldn't load requests"
              description={error ?? 'Something went wrong. Try again.'}
            />
          ) : requests.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="No requests yet"
              description="Create your first payment request and share it with a customer."
              actionLabel="Create Request"
              onActionPress={handleCreateRequest}
            />
          ) : query.length > 0 ? (
            <EmptyState
              icon="search-outline"
              title="No matching requests"
              description="Try a different search term or filter."
            />
          ) : (
            <EmptyState
              icon="funnel-outline"
              title={`No ${activeFilterLabel.toLowerCase()} requests`}
              description="Try a different filter to see more of your requests."
            />
          )
        }
        renderItem={renderRequestRow}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap' },
  filterChip: { paddingVertical: 12, borderWidth: 1 },
});
