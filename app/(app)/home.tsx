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
import { ActivityRow } from '../../src/components/ActivityRow';
import { UserAvatar } from '../../src/components/UserAvatar';
import { TAB_BAR_CONTENT_HEIGHT } from '../../src/components/BottomNavigation';
import { useProfileStore } from '../../src/store/profileStore';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../../src/store/paymentDefaultsStore';
import { useAuthStore } from '../../src/store/authStore';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { resolveDisplayName } from '../../src/utils/resolveDisplayName';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

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
  const customers = useCustomerStore((state) => state.customers);
  const transactions = useTransactionStore((state) => state.transactions);
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  // Narrowed to the two primitive fields actually used below, not the whole
  // `user` object -- that object is rebuilt on every Supabase auth event,
  // including silent background token refreshes with no real change to the
  // name/email, which would otherwise re-render this whole screen for nothing.
  const authUserFullName = useAuthStore((state) => state.user?.fullName);
  const authUserEmail = useAuthStore((state) => state.user?.email);

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
  const receivedThisMonth = useMemo(
    () => monthTransactions.reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions]
  );
  const monthLabel = useMemo(() => new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now), [now]);

  const recentActivity = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'paid')
        .map((r) => ({
          request: r,
          activityAt: transactions.find((t) => t.requestId === r.id)?.paidAt ?? r.createdAt,
        }))
        .sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime())
        .slice(0, 4),
    [requests, transactions]
  );

  const resolvedName = resolveDisplayName(profile?.displayName, authUserFullName, authUserEmail) || 'there';
  const firstName = resolvedName.split(' ')[0];

  function handleRequestPayment() {
    startFresh(defaultExpiryOption);
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
              <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={1}>
                {getGreeting()}, {firstName} 👋
              </Text>
              <Text
                style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}
                numberOfLines={1}
              >
                Welcome back to Spero
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Notifications', "You're all caught up.")}
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
            accessibilityLabel="Notifications"
            hitSlop={6}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

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
          <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>
            {formatCurrency(receivedThisMonth)}
          </Text>
          <Text style={[typography.caption, { color: colors.heroSurfaceTextMuted, marginTop: spacing.sm }]}>
            {monthTransactions.length} payment{monthTransactions.length === 1 ? '' : 's'} · {monthLabel}
          </Text>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <PrimaryButton label="Request Payment" icon="arrow-forward" onPress={handleRequestPayment} />
          <SecondaryButton
            label="Send Payment"
            icon="arrow-forward"
            onPress={() => Alert.alert('Coming soon', 'Send Payment will be available in a future update.')}
          />
        </View>

        <ThemeAwareCard style={{ marginTop: spacing.lg, padding: 0, overflow: 'hidden' }}>
          <View style={styles.statsRow}>
            <StatColumn dotColor={colors.success} label="Paid" value={paidCount} supporting={formatCurrency(paidTotal)} isFirst />
            <StatColumn
              dotColor={colors.pending}
              label="Pending"
              value={pendingCount}
              supporting={formatCurrency(pendingTotal)}
              isFirst={false}
            />
          </View>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title="Recent Activity"
            actionLabel={recentActivity.length > 0 ? 'View All' : undefined}
            onActionPress={() => router.push('/(app)/requests')}
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
                Your completed payments will appear here.
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
            recentActivity.map(({ request, activityAt }, index) => {
              const customer = customers.find((c) => c.id === request.customerId);
              return (
                <View key={request.id}>
                  {index > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
                  <Pressable
                    onPress={() => router.push(`/(app)/requests/${request.id}`)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    accessibilityRole="button"
                    accessibilityLabel={`View request from ${customer?.name ?? 'Unknown'}`}
                  >
                    <ActivityRow
                      customerName={customer?.name ?? 'Unknown'}
                      avatarColor={customer?.avatarColor ?? 'blue'}
                      avatarUrl={customer?.avatarUrl}
                      imageType={customer?.imageType}
                      amount={request.amount}
                      currency={request.currency}
                      status={request.status}
                      createdAt={activityAt}
                    />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  headerTextWrap: { flexShrink: 1 },
  notificationButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center' },
  heroIconWrap: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row' },
  statColumn: { flex: 1, minWidth: 0 },
  statHeader: { flexDirection: 'row', alignItems: 'center' },
  statDot: { width: 8, height: 8 },
  emptyIconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
