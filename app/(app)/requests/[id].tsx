import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { SecondaryButton } from '../../../src/components/SecondaryButton';
import { ConfirmationModal } from '../../../src/components/ConfirmationModal';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestEventStore } from '../../../src/store/requestEventStore';
import { useWalletStore } from '../../../src/store/walletStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { useTransactionStore } from '../../../src/store/transactionStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useRefreshMerchantPaymentData } from '../../../src/store/useRefreshMerchantPaymentData';
import { supabase } from '../../../src/lib/supabase';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { buildReminderMessage } from '../../../src/utils/buildReminderMessage';
import { truncateHash } from '../../../src/utils/truncateHash';
import { getPublicPaymentUrl } from '../../../src/utils/publicPaymentLink';
import type { RequestEventType } from '../../../src/types';

const EVENT_LABELS: Record<RequestEventType, string> = {
  created: 'Request created',
  shared: 'Request shared',
  payment_detected: 'Payment detected',
  payment_confirmed: 'Payment confirmed',
  payment_failed: 'Payment confirmation failed',
  reminder_sent: 'Reminder sent',
  cancelled: 'Request cancelled',
  expired: 'Request expired',
};

const EVENT_ICONS: Record<RequestEventType, keyof typeof Ionicons.glyphMap> = {
  created: 'add-circle-outline',
  shared: 'share-outline',
  payment_detected: 'eye-outline',
  payment_confirmed: 'checkmark-circle-outline',
  payment_failed: 'alert-circle-outline',
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
  const allEvents = useRequestEventStore((state) => state.events);
  const events = useMemo(
    () =>
      id
        ? allEvents
            .filter((e) => e.requestId === id)
            .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
        : [],
    [allEvents, id]
  );
  const wallet = useWalletStore((state) => state.wallet);
  const transaction = useTransactionStore((state) => (request ? state.getTransactionForRequest(request.id) : undefined));
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const cancelRequest = useRequestStore((state) => state.cancelRequest);
  const deleteRequest = useRequestStore((state) => state.deleteRequest);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);
  const userId = useAuthStore((state) => state.user?.id);
  const { refresh: refreshPaymentData, isRefreshing } = useRefreshMerchantPaymentData();

  // A real Solana payment is verified server-side, outside this session --
  // refresh whenever the merchant returns to this screen so a payment that
  // completed while they were elsewhere shows up without an app restart.
  useFocusEffect(
    useCallback(() => {
      refreshPaymentData();
    }, [refreshPaymentData])
  );

  async function recordEvent(requestId: string, type: 'shared' | 'reminder_sent') {
    if (!userId) return;
    const { data, error } = await supabase
      .from('request_events')
      .insert({ user_id: userId, payment_request_id: requestId, event_type: type })
      .select('*')
      .single();
    if (error) {
      // Not user-facing: the share/reminder itself already happened via the
      // native share sheet by the time this runs, so failing loudly here
      // would be confusing. Still worth a dev-visible trace rather than a
      // fully silent swallow.
      if (__DEV__) console.warn(`Failed to record ${type} event for request ${requestId}:`, error);
      return;
    }
    if (data) {
      useRequestEventStore
        .getState()
        .addLocal({ id: data.id, requestId: data.payment_request_id, type: data.event_type, occurredAt: data.occurred_at });
    }
  }

  async function handleShareAgain() {
    if (!request) return;
    const publicLink = getPublicPaymentUrl(request.publicToken);
    await Share.share({ message: publicLink, url: publicLink });
    await recordEvent(request.id, 'shared');
  }

  async function handleSendReminder() {
    if (!request) return;
    const message = buildReminderMessage(request, customer);
    await Share.share({ message });
    await recordEvent(request.id, 'reminder_sent');
  }

  async function handleCopyReminder() {
    if (!request) return;
    const message = buildReminderMessage(request, customer);
    await Clipboard.setStringAsync(message);
    Alert.alert('Copied', 'Reminder message copied to clipboard.');
  }

  async function handleConfirmCancel() {
    if (!request || !userId) return;
    try {
      await cancelRequest(userId, request.id);
      setCancelModalVisible(false);
    } catch {
      setCancelModalVisible(false);
      Alert.alert('Couldn\'t Cancel', "We couldn't cancel this request. Check your connection and try again.");
    }
  }

  function handleCreateAgain() {
    if (!request) return;
    prefillDraft({
      amount: String(request.amount),
      description: request.description,
      customerId: request.customerId,
      expiryOption: request.expiryOption,
      note: request.note,
    });
    router.push('/request/amount');
  }

  async function handleConfirmDelete() {
    if (!request || !userId) return;
    try {
      await deleteRequest(userId, request.id);
      setDeleteModalVisible(false);
      router.replace('/(app)/requests');
    } catch {
      setDeleteModalVisible(false);
      Alert.alert('Couldn\'t Delete', "We couldn't delete this request. Check your connection and try again.");
    }
  }

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
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshPaymentData} tintColor={colors.primaryAction} />}
      >
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
              {getPublicPaymentUrl(request.publicToken)}
            </Text>
          </View>
          {transaction ? (
            <View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Paid Date</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {formatEventDate(transaction.paidAt)}
              </Text>
            </View>
          ) : null}
          {transaction ? (
            <View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Transaction Hash</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                {truncateHash(transaction.txHash)}
              </Text>
            </View>
          ) : null}
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

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="View Invoice" onPress={() => router.push(`/request/invoice?id=${request.id}`)} />
        </View>

        {request.status === 'confirming' ? (
          <>
            <ThemeAwareCard style={{ marginTop: spacing.xl, alignItems: 'center' }}>
              <Ionicons name="sync-outline" size={24} color={colors.textSecondary} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
                Confirming payment on the network…
              </Text>
            </ThemeAwareCard>
            <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
              <SecondaryButton label="Cancel Request" onPress={() => setCancelModalVisible(true)} />
            </View>
          </>
        ) : null}

        {request.status === 'pending' ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label="Share Again" onPress={handleShareAgain} />
            <SecondaryButton label="Send Reminder" onPress={handleSendReminder} />
            <SecondaryButton label="Copy Reminder Message" onPress={handleCopyReminder} />
            <SecondaryButton label="Cancel Request" onPress={() => setCancelModalVisible(true)} />
          </View>
        ) : null}

        {request.status === 'paid' ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <SecondaryButton
              label="View Receipt"
              onPress={() => router.push(`/request/receipt?id=${request.id}`)}
            />
          </View>
        ) : null}

        {request.status === 'expired' || request.status === 'cancelled' ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label="Create Again" onPress={handleCreateAgain} />
            <SecondaryButton label="Delete" onPress={() => setDeleteModalVisible(true)} />
          </View>
        ) : null}
      </ScrollView>

      <ConfirmationModal
        visible={cancelModalVisible}
        title="Cancel this request?"
        description="The customer will no longer be able to pay this request. This can't be undone."
        confirmLabel="Cancel Request"
        cancelLabel="Keep Request"
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelModalVisible(false)}
      />

      <ConfirmationModal
        visible={deleteModalVisible}
        title="Delete this request?"
        description="This will permanently remove the request from your history. This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
});
