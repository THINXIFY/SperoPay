import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestEventStore } from '../../../src/store/requestEventStore';
import { useWalletStore } from '../../../src/store/walletStore';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import type { RequestEventType } from '../../../src/types';

const EVENT_LABELS: Record<RequestEventType, string> = {
  created: 'Request created',
  shared: 'Request shared',
  payment_detected: 'Payment detected',
  payment_confirmed: 'Payment confirmed',
  reminder_sent: 'Reminder sent',
  cancelled: 'Request cancelled',
  expired: 'Request expired',
};

const EVENT_ICONS: Record<RequestEventType, keyof typeof Ionicons.glyphMap> = {
  created: 'add-circle-outline',
  shared: 'share-outline',
  payment_detected: 'eye-outline',
  payment_confirmed: 'checkmark-circle-outline',
  reminder_sent: 'notifications-outline',
  cancelled: 'close-circle-outline',
  expired: 'time-outline',
};

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function RequestDetailScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const events = useRequestEventStore((state) => (id ? state.getEventsForRequest(id) : []));
  const wallet = useWalletStore((state) => state.wallet);

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Request" onBackPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Request Detail" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <ThemeAwareCard variant="hero">
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Amount</Text>
          <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>
            {formatCurrency(request.amount)} {request.currency}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <StatusBadge status={request.status} />
          </View>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Customer</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {customer?.name ?? 'No customer'}
            </Text>
          </View>
          {request.description ? (
            <View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Description</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {request.description}
              </Text>
            </View>
          ) : null}
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Payment ID</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.paymentCode}
            </Text>
          </View>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Stablecoin & Network</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.currency} on {request.network}
            </Text>
          </View>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Created</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {formatEventDate(request.createdAt)}
            </Text>
          </View>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Expiry</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.expiresAt ? formatEventDate(request.expiresAt) : 'Never'}
            </Text>
          </View>
          {wallet ? (
            <View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Receiving Wallet</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                {wallet.address}
              </Text>
            </View>
          ) : null}
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Payment Link</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.paymentLink}
            </Text>
          </View>
        </View>

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
          TIMELINE
        </Text>
        <ThemeAwareCard>
          {events.length === 0 ? (
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>No activity recorded yet.</Text>
          ) : (
            events.map((event, index) => (
              <View
                key={event.id}
                style={[styles.timelineRow, { marginTop: index === 0 ? 0 : spacing.md }]}
              >
                <Ionicons name={EVENT_ICONS[event.type]} size={18} color={colors.textSecondary} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{EVENT_LABELS[event.type]}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{formatEventDate(event.occurredAt)}</Text>
                </View>
              </View>
            ))
          )}
        </ThemeAwareCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
});
