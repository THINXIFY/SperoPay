import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
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
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { buildReminderMessage } from '../../../src/utils/buildReminderMessage';
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
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const cancelRequest = useRequestStore((state) => state.cancelRequest);
  const deleteRequest = useRequestStore((state) => state.deleteRequest);
  const addEvent = useRequestEventStore((state) => state.addEvent);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);

  async function handleShareAgain() {
    if (!request) return;
    await Share.share({ message: request.paymentLink, url: request.paymentLink });
  }

  async function handleSendReminder() {
    if (!request) return;
    const message = buildReminderMessage(request, customer);
    await Share.share({ message });
    addEvent(request.id, 'reminder_sent');
  }

  async function handleCopyReminder() {
    if (!request) return;
    const message = buildReminderMessage(request, customer);
    await Clipboard.setStringAsync(message);
    Alert.alert('Copied', 'Reminder message copied to clipboard.');
  }

  function handleConfirmCancel() {
    if (!request) return;
    cancelRequest(request.id);
    setCancelModalVisible(false);
  }

  function handleCreateAgain() {
    if (!request) return;
    prefillDraft({
      amount: String(request.amount),
      description: request.description,
      customerId: request.customerId,
      expiryOption: request.expiryOption,
      note: request.note ?? '',
    });
    router.push('/request/amount');
  }

  function handleConfirmDelete() {
    if (!request) return;
    deleteRequest(request.id);
    setDeleteModalVisible(false);
    router.replace('/(app)/requests');
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
              onPress={() => Alert.alert('Receipt', 'Receipts are coming in a future update.')}
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
