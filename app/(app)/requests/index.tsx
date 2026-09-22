import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { IconButton } from '../../../src/components/IconButton';
import { TAB_BAR_CONTENT_HEIGHT } from '../../../src/components/BottomNavigation';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { EmptyState } from '../../../src/components/EmptyState';
import { SkeletonLoader } from '../../../src/components/SkeletonLoader';
import { AppRefreshControl } from '../../../src/components/AppRefreshControl';
import { TextButton } from '../../../src/components/TextButton';
import {
  RequestFilterSheet,
  FILTER_OPTIONS,
  SORT_OPTIONS,
  type RequestFilter,
  type RequestSort,
} from '../../../src/components/RequestFilterSheet';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useTransactionStore } from '../../../src/store/transactionStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../../../src/store/paymentDefaultsStore';
import { useRefreshMerchantPaymentData } from '../../../src/store/useRefreshMerchantPaymentData';
import { getDateLabel } from '../../../src/utils/getDateLabel';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { findNewlyExpiredPendingRequestIds } from '../../../src/utils/expiry';
import { filterRequestsByStatus } from '../../../src/utils/filterRequestsByStatus';
import { supabase } from '../../../src/lib/supabase';
import type { Customer, PaymentRequest, Transaction } from '../../../src/types';

// See the live-refresh effect below for why this is a plain DB re-read
// interval, not a verify-payment nudge.
const REQUESTS_LIST_LIVE_POLL_INTERVAL_MS = 15_000;

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
          size={40}
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
        <Text style={[typography.h3, { color: colors.textPrimary, marginLeft: spacing.sm }]} numberOfLines={1}>
          {formatCurrency(request.amount)} <Text style={[typography.caption, { color: colors.textMuted }]}>{request.currency}</Text>
        </Text>
      </View>
      <View style={[styles.footerRow, { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }]}>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {dateLabel}
        </Text>
        <View style={styles.badgeGroup}>
          {request.archivedAt ? (
            <View
              style={[
                styles.archivedBadge,
                { backgroundColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, marginRight: spacing.xs },
              ]}
            >
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Archived</Text>
            </View>
          ) : null}
          <StatusBadge status={request.status} />
        </View>
      </View>
    </Pressable>
  );
});

export default function RequestsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const requests = useRequestStore((state) => state.requests);
  const status = useRequestStore((state) => state.status);
  const error = useRequestStore((state) => state.error);
  const customers = useCustomerStore((state) => state.customers);
  const transactions = useTransactionStore((state) => state.transactions);
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  const defaultCurrency = usePaymentDefaultsStore((state) => state.defaultCurrency);
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [sort, setSort] = useState<RequestSort>('newest');
  const [query, setQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { refresh: refreshPaymentData, isRefreshing } = useRefreshMerchantPaymentData();
  const filterSheetRef = useRef<BottomSheet>(null);
  const [isFilterSheetMounted, setIsFilterSheetMounted] = useState(false);

  // Defense in depth for a reused/backgrounded tab screen whose sheet was
  // left open from an earlier visit -- same pattern as Profile and Request
  // Detail's own sheets.
  useFocusEffect(
    useCallback(() => {
      filterSheetRef.current?.forceClose();
    }, [])
  );

  // A real Solana payment is verified server-side, outside this session --
  // refresh whenever the merchant returns to this list so a payment that
  // completed while they were elsewhere shows up without an app restart
  // (same reasoning as Request Detail's identical effect).
  useFocusEffect(
    useCallback(() => {
      refreshPaymentData();
    }, [refreshPaymentData])
  );

  // Phase 5A payment hardening: while this list is open and at least one
  // visible request is still awaiting payment, periodically re-read it from
  // Supabase so a payment that lands mid-visit shows up without a manual
  // pull-to-refresh. Deliberately just a DB re-read (never its own
  // verify-payment nudge, unlike Request Detail's identical-shaped effect):
  // one open list can show many pending requests at once, and firing one
  // blockchain verification per row per tick would be exactly the
  // "excessive polling" this hardening pass is required to avoid -- Request
  // Detail (opened for one specific request), the payer's own checkout
  // page, and the server-side cron sweep are what actually drive
  // verification; this only picks up whatever they already decided.
  const hasOpenRequest = requests.some((r) => r.status === 'pending' || r.status === 'confirming');
  useFocusEffect(
    useCallback(() => {
      if (!hasOpenRequest) return;
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      function scheduleNext() {
        timer = setTimeout(tick, REQUESTS_LIST_LIVE_POLL_INTERVAL_MS);
      }

      async function tick() {
        await refreshPaymentData();
        if (cancelled) return;
        scheduleNext();
      }

      scheduleNext();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }, [hasOpenRequest, refreshPaymentData])
  );

  // Phase 6C: there is no background sweep that detects a request crossing
  // into expiry (see migration 0018's own comment on
  // record_request_expired_notification) -- this merchant-side effect is
  // the trigger, firing once this list has (re)loaded and noticing a
  // request that's still 'pending' but already past its own expires_at.
  // The RPC itself re-derives expiry from the real column before recording
  // anything, so this is a client-side TRIGGER, never a client-side
  // DECISION. attemptedRef is a same-session, request-id de-dupe purely to
  // avoid re-firing the RPC every poll tick for the same request -- the RPC
  // is independently idempotent regardless (a `where not exists` guard), so
  // this is an optimization, not a correctness requirement.
  const attemptedExpiryRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const newlyExpiredIds = findNewlyExpiredPendingRequestIds(requests, attemptedExpiryRef.current);
    for (const requestId of newlyExpiredIds) {
      attemptedExpiryRef.current.add(requestId);
      supabase.rpc('record_request_expired_notification', { p_request_id: requestId }).then(({ error: rpcError }) => {
        if (rpcError) console.warn('requests: failed to record expired notification', rpcError);
      });
    }
  }, [requests]);

  function openFilterSheet() {
    if (isFilterSheetMounted) filterSheetRef.current?.expand();
    else setIsFilterSheetMounted(true);
  }

  function handleClearFilters() {
    setFilter('all');
    setQuery('');
  }

  const filtered = useMemo(() => {
    const byStatus = filterRequestsByStatus(requests, filter);

    const trimmedQuery = query.trim().toLowerCase();
    const searched =
      trimmedQuery.length === 0
        ? byStatus
        : byStatus.filter((r) => {
            const customer = customers.find((c) => c.id === r.customerId);
            const haystacks = [customer?.name, r.description, r.paymentCode, String(r.amount)];
            return haystacks.some((value) => value?.toLowerCase().includes(trimmedQuery));
          });

    return [...searched].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'highest':
          return b.amount - a.amount;
        case 'lowest':
          return a.amount - b.amount;
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [requests, customers, filter, query, sort]);

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
    startFresh(defaultExpiryOption, defaultCurrency);
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

  const activeFilterLabel = FILTER_OPTIONS.find((f) => f.value === filter)?.label ?? 'All requests';
  const activeSortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.label ?? 'Newest first';
  const isFilterActive = filter !== 'all' || sort !== 'newest';
  const summaryLabel =
    status === 'loaded'
      ? `${filtered.length} ${filtered.length === 1 ? 'request' : 'requests'}${filter !== 'all' ? ` · ${activeFilterLabel}` : ''}`
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <View style={styles.headerRow}>
          <Text style={[typography.h1, { color: colors.textPrimary, flex: 1 }]}>Requests</Text>
          <IconButton
            name="repeat-outline"
            onPress={() => router.push('/recurring')}
            accessibilityLabel="Recurring payments"
          />
        </View>
        {summaryLabel ? (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
            {summaryLabel}
          </Text>
        ) : null}

        <View style={[styles.controlRow, { marginTop: spacing.base, gap: spacing.sm }]}>
          <View
            style={[
              styles.searchRow,
              {
                backgroundColor: colors.surface,
                borderColor: isSearchFocused ? colors.textPrimary : colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                flex: 1,
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

          <Pressable
            onPress={openFilterSheet}
            accessibilityRole="button"
            accessibilityLabel={`Filter and sort requests. Currently ${activeFilterLabel}, ${activeSortLabel}`}
            style={({ pressed }) => [
              styles.filterButton,
              {
                backgroundColor: isFilterActive ? colors.heroSurface : colors.surface,
                borderColor: isFilterActive ? colors.heroSurface : colors.border,
                borderRadius: radius.md,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Ionicons name="options-outline" size={19} color={isFilterActive ? colors.heroSurfaceText : colors.textPrimary} />
            {isFilterActive ? (
              <View
                style={[
                  styles.filterDot,
                  { backgroundColor: colors.primaryAction, borderRadius: radius.full, borderColor: colors.background },
                ]}
              />
            ) : null}
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + spacing.md,
          gap: spacing.sm,
        }}
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
          ) : (
            <View style={{ alignItems: 'center' }}>
              <EmptyState
                icon={query.length > 0 ? 'search-outline' : 'funnel-outline'}
                title={query.length > 0 ? 'No matching requests' : `No ${activeFilterLabel.toLowerCase()}`}
                description={
                  query.length > 0
                    ? 'Try a different search term or filter.'
                    : 'Try a different filter to see more of your requests.'
                }
              />
              <TextButton label="Clear filters" onPress={handleClearFilters} />
            </View>
          )
        }
        renderItem={renderRequestRow}
      />

      {isFilterSheetMounted ? (
        <RequestFilterSheet
          ref={filterSheetRef}
          initialIndex={0}
          filter={filter}
          sort={sort}
          onSelectFilter={setFilter}
          onSelectSort={setSort}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  card: { borderWidth: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeGroup: { flexDirection: 'row', alignItems: 'center' },
  archivedBadge: { alignSelf: 'flex-start' },
  controlRow: { flexDirection: 'row', alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1 },
  filterButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  filterDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderWidth: 1.5 },
});
