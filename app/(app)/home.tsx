import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { SectionHeader } from '../../src/components/SectionHeader';
import { UserAvatar } from '../../src/components/UserAvatar';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { MiniRevenueSparkline } from '../../src/components/MiniRevenueSparkline';
import { TAB_BAR_CONTENT_HEIGHT } from '../../src/components/BottomNavigation';
import { useProfileStore } from '../../src/store/profileStore';
import { useRequestStore } from '../../src/store/requestStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { useNotificationsFeedStore } from '../../src/store/notificationsFeedStore';
import { useNotificationStore } from '../../src/store/notificationStore';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../../src/store/paymentDefaultsStore';
import { useAuthStore } from '../../src/store/authStore';
import { useRefreshMerchantPaymentData } from '../../src/store/useRefreshMerchantPaymentData';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { resolveDisplayName } from '../../src/utils/resolveDisplayName';
import { getNotificationPresentation, notificationToneColorKey } from '../../src/utils/notificationPresentation';
import { filterNotificationsByPreferences } from '../../src/utils/notificationFilters';
import { formatRelativeTime } from '../../src/utils/formatRelativeTime';
import { getRevenueSummary, getRevenueTrend } from '../../src/utils/analytics';

function StatColumn({
  dotColor,
  label,
  value,
  supporting,
  isFirst,
}: {
  dotColor: string;
  label: string;
  value: number;
  supporting: string;
  isFirst: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View
      style={[
        styles.statColumn,
        { padding: spacing.base, borderLeftWidth: isFirst ? 0 : 1, borderLeftColor: colors.border },
      ]}
    >
      <View style={styles.statHeader}>
        <View style={[styles.statDot, { backgroundColor: dotColor, borderRadius: radius.full }]} />
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.xs }]}>{label}</Text>
      </View>
      <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs }]}>{value}</Text>
      <Text
        style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {supporting}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const requests = useRequestStore((state) => state.requests);
  const transactions = useTransactionStore((state) => state.transactions);
  const notifications = useNotificationsFeedStore((state) => state.notifications);
  const preferences = useNotificationStore((state) => state.preferences);
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  const defaultCurrency = usePaymentDefaultsStore((state) => state.defaultCurrency);
  // Narrowed to the two primitive fields actually used below, not the whole
  // `user` object -- that object is rebuilt on every Supabase auth event,
  // including silent background token refreshes with no real change to the
  // name/email, which would otherwise re-render this whole screen for nothing.
  const authUserFullName = useAuthStore((state) => state.user?.fullName);
  const authUserEmail = useAuthStore((state) => state.user?.email);
  const { refresh: refreshPaymentData, isRefreshing } = useRefreshMerchantPaymentData();

  const paidRequests = useMemo(() => requests.filter((r) => r.status === 'paid'), [requests]);
  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
  const paidCount = paidRequests.length;
  const pendingCount = pendingRequests.length;
  const paidTotal = useMemo(() => paidRequests.reduce((sum, r) => sum + r.amount, 0), [paidRequests]);
  const pendingTotal = useMemo(() => pendingRequests.reduce((sum, r) => sum + r.amount, 0), [pendingRequests]);

  const now = useMemo(() => new Date(), []);
  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const paidDate = new Date(t.paidAt);
      return paidDate.getFullYear() === now.getFullYear() && paidDate.getMonth() === now.getMonth();
    });
  }, [transactions, now]);
  const monthLabel = useMemo(() => new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now), [now]);
  // Reused directly from analytics.ts (the same functions the Analytics
  // screen's own Revenue card/chart already use) rather than re-deriving
  // "this month vs last month" and "last 6 months" here a second time.
  const revenue = useMemo(() => getRevenueSummary(transactions, now), [transactions, now]);
  const revenueTrend = useMemo(() => getRevenueTrend(transactions, '6M', now), [transactions, now]);
  // null changePercent means no last-month baseline to compare against
  // (getRevenueSummary's own documented "never invent a percentage against
  // a zero baseline" rule) -- shown as a plain "first payment" note instead
  // of a trend, and omitted entirely when there's nothing to say yet.
  const isRevenueUp = revenue.changePercent !== null && revenue.changePercent >= 0;
  const revenueTrendLabel =
    revenue.changePercent !== null
      ? `${isRevenueUp ? '+' : ''}${Math.round(revenue.changePercent)}% vs last month`
      : revenue.thisMonth > 0
        ? 'First payment this month'
        : null;

  // Phase 6C: the latest 3-5 important business events (payments, reminders,
  // recurring activity, etc.), not just paid requests -- the notifications
  // feed is already sorted newest-first at the source, but re-sorted
  // defensively here in case a future load ever returns it otherwise. A
  // category the merchant disabled in Notification Preferences is excluded
  // here too, same as the Notifications screen itself.
  const visibleNotifications = useMemo(() => filterNotificationsByPreferences(notifications, preferences), [notifications, preferences]);
  const recentActivity = useMemo(
    () => [...visibleNotifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [visibleNotifications]
  );
  const unreadCount = useMemo(() => visibleNotifications.filter((n) => !n.isRead).length, [visibleNotifications]);

  const resolvedName = resolveDisplayName(profile?.displayName, authUserFullName, authUserEmail) || 'there';
  const firstName = resolvedName.split(' ')[0];

  function handleRequestPayment() {
    startFresh(defaultExpiryOption, defaultCurrency);
    router.push('/request/amount');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + spacing.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refreshPaymentData} />}
      >
        <View style={[styles.headerRow, { marginTop: spacing.sm, marginBottom: spacing.lg }]}>
          <Pressable
            onPress={() => router.push('/(app)/profile')}
            style={({ pressed }) => [styles.headerLeft, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            hitSlop={4}
          >
            <UserAvatar name={resolvedName} avatarUri={profile?.avatarUri} borderStyle={profile?.avatarBorderStyle} size={40} />
            <View style={[styles.headerTextWrap, { marginLeft: spacing.sm }]}>
              <Text
                style={[typography.h2, { fontSize: 20, lineHeight: 26, color: colors.textPrimary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                Welcome, {firstName}
              </Text>
              <Text
                style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}
                numberOfLines={1}
              >
                Welcome back to Spero
              </Text>
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/analytics')}
              style={({ pressed }) => [
                styles.notificationButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.full,
                  marginRight: spacing.sm,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Analytics"
              hitSlop={6}
            >
              <Ionicons name="bar-chart-outline" size={20} color={colors.textPrimary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/notifications')}
              style={({ pressed }) => [
                styles.notificationButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.full,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              hitSlop={6}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              {unreadCount > 0 ? (
                <View
                  style={[
                    styles.unreadBadge,
                    { backgroundColor: colors.primaryAction, borderRadius: radius.full, borderColor: colors.background },
                  ]}
                >
                  <Text style={[typography.caption, { color: colors.primaryActionText, fontSize: 10, lineHeight: 12 }]}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/analytics')}
          accessibilityRole="button"
          accessibilityLabel="View analytics"
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <ThemeAwareCard variant="hero" style={{ padding: spacing.xl, borderRadius: radius.xl }}>
            <View style={styles.heroLabelRow}>
              <View
                style={[
                  styles.heroIconWrap,
                  { backgroundColor: `${colors.primaryAction}26`, borderRadius: radius.full },
                ]}
              >
                <Ionicons name="trending-up" size={13} color={colors.primaryAction} />
              </View>
              <Text style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted, marginLeft: spacing.xs }]}>
                Received this month
              </Text>
            </View>
            <View style={styles.heroAmountRow}>
              <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>
                {formatCurrency(revenue.thisMonth)}
              </Text>
              {revenueTrendLabel ? (
                <View
                  style={[
                    styles.trendPill,
                    {
                      backgroundColor: isRevenueUp ? `${colors.primaryAction}26` : 'transparent',
                      borderRadius: radius.full,
                      marginTop: spacing.xs,
                    },
                  ]}
                >
                  {revenue.changePercent !== null ? (
                    <Ionicons
                      name={isRevenueUp ? 'arrow-up' : 'arrow-down'}
                      size={11}
                      color={isRevenueUp ? colors.primaryAction : colors.heroSurfaceTextMuted}
                    />
                  ) : null}
                  <Text
                    style={[
                      typography.caption,
                      { color: isRevenueUp ? colors.primaryAction : colors.heroSurfaceTextMuted, marginLeft: revenue.changePercent !== null ? 2 : 0 },
                    ]}
                  >
                    {revenueTrendLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            {revenueTrend.some((p) => p.value > 0) ? (
              <View style={{ marginTop: spacing.base }}>
                <MiniRevenueSparkline points={revenueTrend} />
              </View>
            ) : null}

            <View style={[styles.heroFooterOuterRow, { marginTop: spacing.base }]}>
              <Text style={[typography.caption, { color: colors.heroSurfaceTextMuted }]}>
                {monthTransactions.length} payment{monthTransactions.length === 1 ? '' : 's'} · {monthLabel}
              </Text>
              <View style={styles.heroFooterRow}>
                <Text style={[typography.caption, { color: colors.heroSurfaceTextMuted }]}>Analytics</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.heroSurfaceTextMuted} style={{ marginLeft: 2 }} />
              </View>
            </View>
          </ThemeAwareCard>
        </Pressable>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <PrimaryButton label="Request Payment" icon="arrow-forward" onPress={handleRequestPayment} />
          <SecondaryButton
            label="Send Payment"
            icon="arrow-forward"
            onPress={() => Alert.alert('Coming soon', 'Send Payment will be available in a future update.')}
          />
        </View>

        {/* Quick stats -- deliberately borderless/unboxed (spec: card
            hierarchy). A hero card and a real content list (Recent Activity
            below) earn a card treatment; two supporting numbers sitting
            right under the hero don't need to be boxed again too -- that
            was reading as "yet another card" stacked directly under the
            hero, flattening the whole screen into a wall of identical
            boxes. */}
        <View style={[styles.statsRow, { marginTop: spacing.lg, paddingVertical: spacing.xs }]}>
          <StatColumn dotColor={colors.success} label="Paid" value={paidCount} supporting={formatCurrency(paidTotal)} isFirst />
          <StatColumn
            dotColor={colors.pending}
            label="Pending"
            value={pendingCount}
            supporting={formatCurrency(pendingTotal)}
            isFirst={false}
          />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title="Recent Activity"
            actionLabel={recentActivity.length > 0 ? 'View All' : undefined}
            onActionPress={() => router.push('/notifications')}
          />
          {recentActivity.length === 0 ? (
            <ThemeAwareCard style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <View
                style={[
                  styles.emptyIconWrap,
                  { backgroundColor: colors.background, borderRadius: radius.full, borderColor: colors.border },
                ]}
              >
                <Ionicons name="receipt-outline" size={18} color={colors.textMuted} />
              </View>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
                No activity yet
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textMuted, marginTop: spacing.xs / 2, textAlign: 'center' },
                ]}
              >
                Important payment and business activity will appear here.
              </Text>
              <Pressable
                onPress={handleRequestPayment}
                style={({ pressed }) => ({ marginTop: spacing.md, opacity: pressed ? 0.6 : 1 })}
                accessibilityRole="button"
                accessibilityLabel="Create request"
                hitSlop={8}
              >
                <Text style={[typography.bodySmall, { color: colors.primaryAction }]}>Create request →</Text>
              </Pressable>
            </ThemeAwareCard>
          ) : (
            <ThemeAwareCard style={{ padding: 0, overflow: 'hidden' }}>
              {recentActivity.map((notification, index) => {
                const presentation = getNotificationPresentation(notification.type);
                const toneColor = colors[notificationToneColorKey(presentation.tone)];
                return (
                  <Pressable
                    key={notification.id}
                    onPress={() => router.push('/notifications')}
                    style={({ pressed }) => [
                      styles.activityRow,
                      {
                        paddingHorizontal: spacing.base,
                        paddingVertical: spacing.sm + spacing.xs,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: colors.border,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={notification.title}
                  >
                    {/* Same tone-accent device as the Notifications screen's
                        own rows -- ties the two screens' activity feeds
                        together visually instead of Home reinventing its
                        own, third icon treatment. */}
                    <View style={[styles.activityAccentBar, { backgroundColor: toneColor, borderRadius: radius.full, marginRight: spacing.sm }]} />
                    <View style={[styles.activityIconChip, { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.background }]}>
                      <Ionicons name={presentation.icon} size={14} color={toneColor} />
                    </View>
                    <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                      <Text style={[typography.bodySmall, { color: colors.textPrimary }]} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      {notification.message ? (
                        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                          {notification.message}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.sm }]}>
                      {formatRelativeTime(notification.createdAt)}
                    </Text>
                  </Pressable>
                );
              })}
            </ThemeAwareCard>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // flex: 1 -- headerActions (two fixed 40px icon buttons) is auto-sized,
  // so this deterministically claims exactly "everything left after
  // headerActions" instead of a content-based shrink-to-fit box, which is
  // what lets the nested headerTextWrap's own flex: 1 resolve to a real,
  // stable width for adjustsFontSizeToFit to measure against.
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  // flex: 1 (not just flexShrink) so this always resolves to a definite
  // width -- "everything left in headerLeft after the avatar" -- which is
  // what adjustsFontSizeToFit needs to reliably measure against. Without a
  // definite box, a long display name could still clip before the shrink
  // kicked in on some widths.
  headerTextWrap: { flex: 1 },
  notificationButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center' },
  heroAmountRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 },
  trendPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3 },
  heroFooterOuterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroFooterRow: { flexDirection: 'row', alignItems: 'center' },
  heroIconWrap: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row' },
  statColumn: { flex: 1, minWidth: 0 },
  statHeader: { flexDirection: 'row', alignItems: 'center' },
  statDot: { width: 8, height: 8 },
  emptyIconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  activityRow: { flexDirection: 'row', alignItems: 'center' },
  activityAccentBar: { width: 3, alignSelf: 'stretch' },
  activityIconChip: { alignItems: 'center', justifyContent: 'center' },
});
