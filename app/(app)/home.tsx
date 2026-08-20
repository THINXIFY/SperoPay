import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { SectionHeader } from '../../src/components/SectionHeader';
import { ActivityRow } from '../../src/components/ActivityRow';
import { useProfileStore } from '../../src/store/profileStore';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../../src/store/paymentDefaultsStore';
import { formatCurrency } from '../../src/utils/formatCurrency';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  supporting,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number;
  supporting: string;
}) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <ThemeAwareCard style={{ flex: 1, minWidth: 0, padding: spacing.sm }}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconWrap, { backgroundColor: iconBg, borderRadius: radius.full }]}>
          <Ionicons name={icon} size={12} color={iconColor} />
        </View>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginLeft: spacing.xs }]}>{label}</Text>
      </View>
      <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.xs }]}>{value}</Text>
      <Text
        style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {supporting}
      </Text>
    </ThemeAwareCard>
  );
}

export default function HomeScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const requests = useRequestStore((state) => state.requests);
  const customers = useCustomerStore((state) => state.customers);
  const transactions = useTransactionStore((state) => state.transactions);
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);

  const paidRequests = useMemo(() => requests.filter((r) => r.status === 'paid'), [requests]);
  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
  const paidCount = paidRequests.length;
  const pendingCount = pendingRequests.length;
  const paidTotal = useMemo(() => paidRequests.reduce((sum, r) => sum + r.amount, 0), [paidRequests]);
  const pendingTotal = useMemo(() => pendingRequests.reduce((sum, r) => sum + r.amount, 0), [pendingRequests]);

  const monthTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((t) => {
      const paidDate = new Date(t.paidAt);
      return paidDate.getFullYear() === now.getFullYear() && paidDate.getMonth() === now.getMonth();
    });
  }, [transactions]);
  const receivedThisMonth = useMemo(
    () => monthTransactions.reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions]
  );

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

  const firstName = (profile.displayName || 'there').split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerRow, { marginTop: spacing.sm, marginBottom: spacing.lg }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatar, { backgroundColor: colors.softLavender, borderRadius: radius.full }]}>
              <Text style={[typography.bodyMedium, { color: colors.softLavenderText }]}>
                {firstName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={[styles.headerTextWrap, { marginLeft: spacing.sm }]}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                {getGreeting()}, {firstName} 👋
              </Text>
              <Text
                style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}
                numberOfLines={1}
              >
                Welcome back to Spero
              </Text>
            </View>
          </View>
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
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginLeft: spacing.xs }]}>
              Received this month
            </Text>
          </View>
          <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.sm }]}>
            {formatCurrency(receivedThisMonth)}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {monthTransactions.length} payment{monthTransactions.length === 1 ? '' : 's'} this month
          </Text>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <PrimaryButton
            label="Request Payment"
            icon="arrow-forward"
            onPress={() => {
              startFresh(defaultExpiryOption);
              router.push('/request/amount');
            }}
          />
          <SecondaryButton
            label="Send Payment"
            icon="arrow-forward"
            onPress={() => Alert.alert('Coming soon', 'Send Payment will be available in a future update.')}
          />
        </View>

        <View style={[styles.statsRow, { marginTop: spacing.lg, gap: spacing.md }]}>
          <StatCard
            icon="checkmark-circle"
            iconColor={colors.success}
            iconBg={`${colors.success}26`}
            label="Paid"
            value={paidCount}
            supporting={formatCurrency(paidTotal)}
          />
          <StatCard
            icon="time-outline"
            iconColor={colors.pending}
            iconBg={`${colors.pending}26`}
            label="Pending"
            value={pendingCount}
            supporting={formatCurrency(pendingTotal)}
          />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title="Recent Activity"
            actionLabel="View All"
            onActionPress={() => router.push('/(app)/requests')}
          />
          {recentActivity.length === 0 ? (
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Paid activity will show up here.
            </Text>
          ) : (
            recentActivity.map(({ request, activityAt }, index) => {
              const customer = customers.find((c) => c.id === request.customerId);
              return (
                <View key={request.id}>
                  {index > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
                  <ActivityRow
                    customerName={customer?.name ?? 'Unknown'}
                    avatarColor={customer?.avatarColor ?? 'blue'}
                    amount={request.amount}
                    currency={request.currency}
                    status={request.status}
                    createdAt={activityAt}
                  />
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
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  notificationButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center' },
  heroIconWrap: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row' },
  statHeader: { flexDirection: 'row', alignItems: 'center' },
  statIconWrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
});
