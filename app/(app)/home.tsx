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

export default function HomeScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const requests = useRequestStore((state) => state.requests);
  const customers = useCustomerStore((state) => state.customers);
  const transactions = useTransactionStore((state) => state.transactions);
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);

  const paidCount = useMemo(() => requests.filter((r) => r.status === 'paid').length, [requests]);
  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

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
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}>
        <View style={[styles.headerRow, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatar, { backgroundColor: colors.softLavender, borderRadius: radius.full }]}>
              <Text style={[typography.bodyMedium, { color: colors.softLavenderText }]}>
                {firstName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {getGreeting()}, {firstName} 👋
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Welcome back to Spero</Text>
            </View>
          </View>
          <Pressable
            onPress={() => Alert.alert('Notifications', "You're all caught up.")}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ThemeAwareCard variant="hero">
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Received this month</Text>
          <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>
            {formatCurrency(receivedThisMonth)}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
            {monthTransactions.length} payment{monthTransactions.length === 1 ? '' : 's'} this month
          </Text>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.base, gap: spacing.sm }}>
          <PrimaryButton
            label="Request Payment →"
            onPress={() => {
              startFresh(defaultExpiryOption);
              router.push('/request/amount');
            }}
          />
          <SecondaryButton
            label="Send Payment →"
            onPress={() => Alert.alert('Coming soon', 'Send Payment will be available in a future update.')}
          />
        </View>

        <View style={[styles.statsRow, { marginTop: spacing.xl, gap: spacing.md }]}>
          <ThemeAwareCard style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Paid</Text>
            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs }]}>{paidCount}</Text>
          </ThemeAwareCard>
          <ThemeAwareCard style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Pending</Text>
            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs }]}>{pendingCount}</Text>
          </ThemeAwareCard>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="Recent Activity"
            actionLabel="View All"
            onActionPress={() => router.push('/(app)/requests')}
          />
          {recentActivity.map(({ request, activityAt }) => {
            const customer = customers.find((c) => c.id === request.customerId);
            return (
              <ActivityRow
                key={request.id}
                customerName={customer?.name ?? 'Unknown'}
                avatarColor={customer?.avatarColor ?? 'blue'}
                amount={request.amount}
                currency={request.currency}
                status={request.status}
                createdAt={activityAt}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row' },
});
