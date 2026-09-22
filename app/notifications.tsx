import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme';
import { IconButton } from '../src/components/IconButton';
import { TextButton } from '../src/components/TextButton';
import { AppRefreshControl } from '../src/components/AppRefreshControl';
import { AppBottomSheet } from '../src/components/AppBottomSheet';
import { ThemeAwareCard } from '../src/components/ThemeAwareCard';
import { EmptyState } from '../src/components/EmptyState';
import { SkeletonLoader } from '../src/components/SkeletonLoader';
import { SectionLabel } from '../src/components/SectionLabel';
import { CustomerAvatar } from '../src/components/CustomerAvatar';
import { useAuthStore } from '../src/store/authStore';
import { useNotificationsFeedStore, type AppNotification } from '../src/store/notificationsFeedStore';
import { useNotificationStore } from '../src/store/notificationStore';
import { useRequestStore } from '../src/store/requestStore';
import { useCustomerStore } from '../src/store/customerStore';
import { useRefreshMerchantPaymentData } from '../src/store/useRefreshMerchantPaymentData';
import {
  getNotificationPresentation,
  getNotificationNavigationTarget,
  notificationToneColorKey,
  type NotificationTone,
} from '../src/utils/notificationPresentation';
import type { ThemeColors } from '../src/theme/colors';
import {
  filterNotifications,
  filterNotificationsByPreferences,
  NOTIFICATION_FILTER_OPTIONS,
  type NotificationFilter,
} from '../src/utils/notificationFilters';
import { groupByDayBucket, type DayGroup } from '../src/utils/activityGrouping';
import { formatRelativeTime } from '../src/utils/formatRelativeTime';
import { parsePaymentAmountFromMessage } from '../src/utils/notificationDisplay';
import { formatCurrency } from '../src/utils/formatCurrency';
import type { Customer } from '../src/types';

const AVATAR_ELIGIBLE_TYPES: AppNotification['type'][] = ['payment_received', 'payment_partial', 'customer_added'];

// Only tones with a clean, purpose-built "soft" background token in the
// theme get a tinted icon chip (success/danger/info) -- warning/neutral fall
// back to the plain background chip below rather than forcing an
// ill-fitting color onto a token that was never designed for this.
const TONE_CHIP_BACKGROUND: Partial<Record<NotificationTone, keyof ThemeColors>> = {
  success: 'softMint',
  danger: 'softRed',
  info: 'softBlue',
};

// Spero's Notification Center (Phase 6C) -- a curated, cross-request feed
// of the business events that actually matter (payment received, a
// reminder failing, a new customer), backed by the dedicated `notifications`
// table (migration 0018). Deliberately narrower than Request Detail's own
// Timeline (still powered by request_events): that screen is a complete
// per-request audit log, this one is "only useful business events" (spec)
// across the whole account, with real, server-persisted unread state.
//
// This pass is a visual refinement only -- every data source, mutation,
// and navigation rule below is unchanged from Phase 6C. The one addition
// (parsePaymentAmountFromMessage + the customer/request cross-reference
// for an avatar) is purely a client-side DISPLAY transform over data
// that's already loaded for other screens; it never re-derives, stores,
// or trusts anything the server didn't already author.
export default function NotificationsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const userId = useAuthStore((state) => state.user?.id);
  const notifications = useNotificationsFeedStore((state) => state.notifications);
  const status = useNotificationsFeedStore((state) => state.status);
  const markAsRead = useNotificationsFeedStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationsFeedStore((state) => state.markAllAsRead);
  const preferences = useNotificationStore((state) => state.preferences);
  const requests = useRequestStore((state) => state.requests);
  const customers = useCustomerStore((state) => state.customers);
  const { refresh, isRefreshing } = useRefreshMerchantPaymentData();

  const [filter, setFilter] = useState<NotificationFilter>('all');
  const filterSheetRef = useRef<BottomSheet>(null);
  const [isFilterSheetMounted, setIsFilterSheetMounted] = useState(false);

  // Preferences (a disabled category) are applied FIRST -- a category the
  // merchant turned off is invisible everywhere on this screen, including
  // the unread count, regardless of which filter chip is separately active.
  const visibleNotifications = useMemo(() => filterNotificationsByPreferences(notifications, preferences), [notifications, preferences]);
  const sortedNotifications = useMemo(
    () => [...visibleNotifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [visibleNotifications]
  );
  const filteredNotifications = useMemo(() => filterNotifications(sortedNotifications, filter), [sortedNotifications, filter]);
  const groups = useMemo(() => groupByDayBucket(filteredNotifications, (n) => n.createdAt), [filteredNotifications]);
  const unreadCount = useMemo(() => visibleNotifications.filter((n) => !n.isRead).length, [visibleNotifications]);
  const filterLabel = NOTIFICATION_FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? 'All Activity';

  // Display-only cross-reference (avatar resolution) -- both arrays are
  // already loaded for Requests/Customers, no new fetch. A payment
  // notification's entityId is the REQUEST it belongs to, not a customer
  // directly, so resolving its avatar is two hops: request -> customerId ->
  // customer. customer_added's entityId already IS a customer id.
  const customerById = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const customer of customers) map.set(customer.id, customer);
    return map;
  }, [customers]);
  const requestCustomerId = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const request of requests) map.set(request.id, request.customerId);
    return map;
  }, [requests]);

  function resolveNotificationCustomer(notification: AppNotification): Customer | undefined {
    if (!notification.entityId || !AVATAR_ELIGIBLE_TYPES.includes(notification.type)) return undefined;
    if (notification.entityType === 'customer') return customerById.get(notification.entityId);
    if (notification.entityType === 'request') {
      const customerId = requestCustomerId.get(notification.entityId);
      return customerId ? customerById.get(customerId) : undefined;
    }
    return undefined;
  }

  async function handlePress(notification: AppNotification) {
    if (!notification.isRead && userId) {
      markAsRead(userId, notification.id).catch(() => {});
    }
    const target = getNotificationNavigationTarget(notification);
    if (target) router.push(target as never);
  }

  function handleMarkAllAsRead() {
    if (!userId || unreadCount === 0) return;
    markAllAsRead(userId).catch(() => {});
  }

  function renderGroup({ item: group }: { item: DayGroup<AppNotification> }) {
    return (
      <View>
        <SectionLabel>{group.label.toUpperCase()}</SectionLabel>
        <ThemeAwareCard style={{ padding: 0, overflow: 'hidden' }}>
          {group.items.map((notification, index) => {
            const presentation = getNotificationPresentation(notification.type);
            const isUnread = !notification.isRead;
            const customer = resolveNotificationCustomer(notification);
            const paymentInfo =
              notification.type === 'payment_received' || notification.type === 'payment_partial'
                ? parsePaymentAmountFromMessage(notification.message)
                : null;
            const toneColor = colors[notificationToneColorKey(presentation.tone)];
            const chipBackgroundKey = TONE_CHIP_BACKGROUND[presentation.tone];
            const iconChipBackground = chipBackgroundKey ? colors[chipBackgroundKey] : colors.background;

            return (
              <Pressable
                key={notification.id}
                onPress={() => handlePress(notification)}
                accessibilityRole="button"
                accessibilityLabel={`${notification.title}${isUnread ? ', unread' : ''}`}
                style={({ pressed }) => [
                  styles.row,
                  {
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.sm + spacing.xs,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                    backgroundColor: isUnread ? colors.primaryActionSoft : 'transparent',
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.accentBar,
                    { backgroundColor: toneColor, borderRadius: radius.full, opacity: isUnread ? 1 : 0.35, marginRight: spacing.sm },
                  ]}
                />

                <View style={styles.avatarSlot}>
                  {customer ? (
                    <CustomerAvatar name={customer.name} color={customer.avatarColor} avatarUrl={customer.avatarUrl} imageType={customer.imageType} size={38} />
                  ) : (
                    <View style={[styles.iconChip, { width: 38, height: 38, borderRadius: radius.full, backgroundColor: iconChipBackground }]}>
                      <Ionicons name={presentation.icon} size={17} color={toneColor} />
                    </View>
                  )}
                  {isUnread ? (
                    <View style={[styles.avatarDot, { backgroundColor: colors.primaryAction, borderRadius: radius.full, borderColor: colors.background }]} />
                  ) : null}
                </View>

                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[isUnread ? typography.bodyMedium : typography.body, { color: colors.textPrimary, flex: 1 }]}
                      numberOfLines={1}
                    >
                      {notification.title}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.sm }]} numberOfLines={1}>
                      {formatRelativeTime(notification.createdAt)}
                    </Text>
                  </View>

                  {paymentInfo ? (
                    <>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                        {formatCurrency(Number(paymentInfo.amountText))} {paymentInfo.currency}
                        {customer ? ` from ${customer.name}` : ''}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                        {paymentInfo.paymentCode}
                      </Text>
                    </>
                  ) : notification.message ? (
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs / 2 }]} numberOfLines={2}>
                      {notification.message}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ThemeAwareCard>
      </View>
    );
  }

  function renderBody() {
    if (status === 'loading' && notifications.length === 0) {
      return (
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.skeletonRow, { gap: spacing.sm }]}>
              <SkeletonLoader width={36} height={36} style={{ borderRadius: 999 }} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <SkeletonLoader width="55%" height={13} />
                <SkeletonLoader width="75%" height={13} />
                <SkeletonLoader width="30%" height={11} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (status === 'error') {
      return (
        <View style={{ marginTop: spacing.xxl }}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Unable to load notifications"
            description="Please try again."
            actionLabel="Try Again"
            onActionPress={refresh}
          />
        </View>
      );
    }

    return (
      <FlatList
        data={groups}
        keyExtractor={(group) => group.label}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, gap: spacing.lg, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        renderItem={renderGroup}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="You're all caught up"
              description="Payment and account updates will appear here."
            />
          </View>
        }
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={[styles.header, { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md }]}>
        <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={1}>
            Notifications
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
            Payment and account activity
          </Text>
        </View>
        {unreadCount > 0 ? (
          <TextButton label="Mark all read" onPress={handleMarkAllAsRead} />
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={[styles.toolbarRow, { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }]}>
        <Pressable
          onPress={() => (isFilterSheetMounted ? filterSheetRef.current?.expand() : setIsFilterSheetMounted(true))}
          accessibilityRole="button"
          accessibilityLabel={`Filter: ${filterLabel}. Change filter`}
          style={({ pressed }) => [
            styles.filterPill,
            styles.filterShadow,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 2, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="options-outline" size={15} color={colors.textPrimary} style={{ marginRight: spacing.xs / 2 }} />
          <Text style={[typography.bodySmall, { color: colors.textPrimary }]} numberOfLines={1}>
            {filterLabel}
          </Text>
          {filter !== 'all' ? (
            <View style={[styles.filterActiveDot, { backgroundColor: colors.primaryAction, borderRadius: radius.full, marginLeft: spacing.xs / 2 }]} />
          ) : (
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} style={{ marginLeft: spacing.xs / 2 }} />
          )}
        </Pressable>
        {unreadCount > 0 ? (
          <View style={[styles.unreadPill, { backgroundColor: colors.primaryActionSoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2 }]}>
            <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
              {unreadCount} new
            </Text>
          </View>
        ) : null}
      </View>

      {renderBody()}

      {isFilterSheetMounted ? (
        <AppBottomSheet ref={filterSheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Filter Activity</Text>
          {NOTIFICATION_FILTER_OPTIONS.map((option) => {
            const isActive = option.value === filter;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setFilter(option.value);
                  filterSheetRef.current?.close();
                }}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.filterRow,
                  {
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.md,
                    backgroundColor: isActive ? colors.softMint : 'transparent',
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                <Text style={[typography.body, { color: isActive ? colors.softMintText : colors.textPrimary, flex: 1 }]}>{option.label}</Text>
                {isActive ? <Ionicons name="checkmark-circle" size={20} color={colors.softMintText} /> : null}
              </Pressable>
            );
          })}
        </AppBottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1 },
  filterShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  filterActiveDot: { width: 6, height: 6 },
  unreadPill: { alignSelf: 'flex-start' },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  accentBar: { width: 3, alignSelf: 'stretch' },
  avatarSlot: { position: 'relative' },
  iconChip: { alignItems: 'center', justifyContent: 'center' },
  avatarDot: { position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderWidth: 1.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  skeletonRow: { flexDirection: 'row', alignItems: 'flex-start' },
});
