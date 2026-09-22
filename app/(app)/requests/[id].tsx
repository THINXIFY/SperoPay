import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Share, Alert, Linking, Switch, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { AppRefreshControl } from '../../../src/components/AppRefreshControl';
import { TAB_BAR_CONTENT_HEIGHT } from '../../../src/components/BottomNavigation';
import { EmptyState } from '../../../src/components/EmptyState';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { SecondaryButton } from '../../../src/components/SecondaryButton';
import { DetailRow } from '../../../src/components/DetailRow';
import { SectionLabel } from '../../../src/components/SectionLabel';
import { SelectField } from '../../../src/components/SelectField';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { ConfirmationModal } from '../../../src/components/ConfirmationModal';
import { AppMessageModal } from '../../../src/components/AppMessageModal';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { AppActionSheet, type ActionSheetItem } from '../../../src/components/AppActionSheet';
import { ReminderPresetSheet } from '../../../src/components/ReminderPresetSheet';
import { ReminderStatusCard } from '../../../src/components/ReminderStatusCard';
import { FullScreenQRModal } from '../../../src/components/FullScreenQRModal';
import { ExplorerLinkRow } from '../../../src/components/ExplorerLinkRow';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useProfileStore } from '../../../src/store/profileStore';
import { useRequestEventStore } from '../../../src/store/requestEventStore';
import { useWalletStore } from '../../../src/store/walletStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { useTransactionStore } from '../../../src/store/transactionStore';
import { useReminderStore } from '../../../src/store/reminderStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useRefreshMerchantPaymentData } from '../../../src/store/useRefreshMerchantPaymentData';
import { triggerPaymentVerification } from '../../../src/services/publicCheckout/verifyPayment';
import { supabase } from '../../../src/lib/supabase';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { buildReminderMessage } from '../../../src/utils/buildReminderMessage';
import { buildAutomaticReminderMessage } from '../../../src/utils/buildAutomaticReminderMessage';
import { truncateHash } from '../../../src/utils/truncateHash';
import { getPublicPaymentUrl } from '../../../src/utils/publicPaymentLink';
import { addCustomRule, reminderRuleLabel, reminderScheduleSummary, rulesForPreset } from '../../../src/utils/reminderSchedule';
import { reminderStatusPresentation, friendlyReminderReason } from '../../../src/utils/reminderPresentation';
import { computePaymentAccounting } from '../../../src/utils/paymentAccounting';
import { buildSolanaPayUrl } from '../../../src/services/blockchain/solana/solanaPayUri';
import { requestDebugLog } from '../../../src/utils/requestDebugLog';
import type { ReminderPreset, ReminderRule, RequestEventType, Transaction } from '../../../src/types';

const EMPTY_TRANSACTIONS: Transaction[] = [];

const DEVICE_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const SEND_TIME_OPTIONS = [
  { hour: 9, minute: 0, label: '9:00 AM' },
  { hour: 10, minute: 0, label: '10:00 AM' },
  { hour: 12, minute: 0, label: '12:00 PM' },
  { hour: 14, minute: 0, label: '2:00 PM' },
  { hour: 17, minute: 0, label: '5:00 PM' },
];
// A merchant tapping "Send now" repeatedly must never queue up several
// real sends for the same customer -- see spec's spam-protection section.
const MANUAL_SEND_COOLDOWN_MS = 10_000;
// Phase 5A payment hardening: while a merchant is actually looking at a
// still-open request, nudge the same server-side verification the payer's
// own checkout page already triggers, so "customer pays while the merchant
// app is already open" resolves without a manual pull-to-refresh -- see the
// live-refresh effect below. Deliberately close to (not faster than)
// usePublicCheckoutPolling's own DEFAULT_POLL_INTERVAL_MS: this is
// best-effort redundancy for one open screen, not the primary verification
// channel (that's the payer's own polling, plus Phase 5A's cron sweep for
// when nobody's app is open at all).
const MERCHANT_LIVE_POLL_INTERVAL_MS = 10_000;
// Taller than AppBottomSheet's 40%/70% default: the custom-rule builder can
// grow past 70% of screen height on smaller devices, and scrollable={true}
// on AppBottomSheet lets content scroll internally within this cap.
const MANAGE_SHEET_SNAP_POINTS = ['60%', '85%'];
const SEND_TIME_SHEET_SNAP_POINTS = ['45%'];

const EVENT_LABELS: Record<RequestEventType, string> = {
  created: 'Request created',
  shared: 'Request shared',
  payment_detected: 'Payment detected',
  payment_confirmed: 'Payment confirmed',
  payment_failed: 'Payment confirmation failed',
  reminder_sent: 'Reminder sent',
  reminder_scheduled: 'Reminders scheduled',
  reminder_failed: "Reminder couldn't be sent",
  reminder_cancelled: 'Reminders stopped',
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
  reminder_scheduled: 'alarm-outline',
  reminder_failed: 'warning-outline',
  reminder_cancelled: 'notifications-off-outline',
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

// One compact icon + label action, used for the "secondary compact
// actions" row (QR / Share / Invoice / Receipt) -- deliberately smaller
// and quieter than ActionCard's full-width row, since up to four of these
// sit side by side (spec: "Avoid a long stack of buttons").
function CompactAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.compactAction, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={[
          styles.compactActionIcon,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.full },
        ]}
      >
        <Ionicons name={icon} size={19} color={colors.textPrimary} />
      </View>
      <Text
        style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs / 2 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
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
  // NOT `useTransactionStore((state) => state.getTransactionsForRequest(...))`:
  // that store method does `.filter().sort()`, which allocates a brand-new
  // array on every single call. A Zustand selector that returns a fresh
  // reference every time it runs never compares equal to its own previous
  // result, so the store's external-store subscription sees "changed" on
  // every render, forever -- this was the exact cause of a real
  // "Maximum update depth exceeded" crash on this screen. Selecting the
  // stable `transactions` array (a new reference only when the store
  // actually replaces it) and deriving the per-request list locally via
  // useMemo is the same safe pattern `events` already uses two lines above.
  const allTransactions = useTransactionStore((state) => state.transactions);
  const requestTransactions = useMemo(
    () =>
      request
        ? allTransactions
            .filter((t) => t.requestId === request.id)
            .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime())
        : EMPTY_TRANSACTIONS,
    [allTransactions, request]
  );
  const accounting = useMemo(
    () => (request ? computePaymentAccounting(request, requestTransactions) : null),
    [request, requestTransactions]
  );

  const profile = useProfileStore((state) => state.profile);

  // The exact canonical Solana Pay URI -- same buildSolanaPayUrl call
  // created.tsx's own QR uses, never a second implementation (spec: "Do
  // NOT create a second QR-generation implementation"). Powers both this
  // screen's own QR display and the Full-Screen QR modal it opens; neither
  // ever regenerates the reference, since it's read straight from the
  // already-persisted request.solanaReference.
  const solanaPayUri = useMemo(() => {
    if (!request || !wallet?.address || !request.solanaReference) return null;
    try {
      const uri = buildSolanaPayUrl({
        recipient: wallet.address,
        reference: request.solanaReference,
        amount: request.amount,
        asset: request.currency,
        label: profile?.businessName?.trim() || profile?.displayName?.trim() || undefined,
        message: request.description ? `Payment for ${request.description}` : `Payment request ${request.paymentCode}`,
      });
      // Temporary diagnostic checkpoint (see requestDebugLog.ts) -- not
      // secret, it's exactly what the QR itself already encodes.
      requestDebugLog('requestDetail: current Solana Pay QR URI', { uri, paymentCode: request.paymentCode, status: request.status });
      return uri;
    } catch (error) {
      requestDebugLog('requestDetail: failed to build Solana Pay QR URI', {
        paymentCode: request.paymentCode,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }, [request, wallet?.address, profile?.businessName, profile?.displayName]);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [archiveActionError, setArchiveActionError] = useState<{ title: string; description: string } | null>(null);
  const cancelRequest = useRequestStore((state) => state.cancelRequest);
  const deleteRequest = useRequestStore((state) => state.deleteRequest);
  const archiveRequest = useRequestStore((state) => state.archiveRequest);
  const restoreRequest = useRequestStore((state) => state.restoreRequest);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);
  const userId = useAuthStore((state) => state.user?.id);
  const { refresh: refreshPaymentData, isRefreshing } = useRefreshMerchantPaymentData();

  const schedule = useReminderStore((state) => (request ? state.schedulesByRequest[request.id] : undefined));
  const reminders = useReminderStore((state) => (request ? state.remindersByRequest[request.id] : undefined)) ?? [];
  const saveReminderSchedule = useReminderStore((state) => state.saveSchedule);
  const loadRemindersForRequest = useReminderStore((state) => state.loadForRequest);

  const manageSheetRef = useRef<BottomSheet>(null);
  const reminderPresetSheetRef = useRef<BottomSheet>(null);
  const sendTimeSheetRef = useRef<BottomSheet>(null);
  const sendNowSheetRef = useRef<BottomSheet>(null);
  const overflowSheetRef = useRef<BottomSheet>(null);
  const [isManageSheetMounted, setIsManageSheetMounted] = useState(false);
  const [isReminderPresetSheetMounted, setIsReminderPresetSheetMounted] = useState(false);
  const [isSendTimeSheetMounted, setIsSendTimeSheetMounted] = useState(false);
  const [isSendNowSheetMounted, setIsSendNowSheetMounted] = useState(false);
  const [isOverflowSheetMounted, setIsOverflowSheetMounted] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>('standard');
  const [customReminderRules, setCustomReminderRules] = useState<ReminderRule[]>([]);
  const [sendHour, setSendHour] = useState(10);
  const [sendMinute, setSendMinute] = useState(0);
  const [isSavingReminders, setIsSavingReminders] = useState(false);
  const [newRuleValue, setNewRuleValue] = useState(3);
  const [newRuleUnit, setNewRuleUnit] = useState<'days' | 'weeks'>('days');
  const [newRuleDirection, setNewRuleDirection] = useState<'before_due' | 'after_due'>('after_due');
  const manualSendCooldownRef = useRef(0);

  // A real Solana payment is verified server-side, outside this session --
  // refresh whenever the merchant returns to this screen so a payment that
  // completed while they were elsewhere shows up without an app restart.
  // Reminders are refreshed the same way: the server-side processor can
  // change their status (sent/failed) with this screen closed the whole
  // time, and paid/cancelled transitions cancel them server-side too (see
  // migration 0011's trigger).
  useFocusEffect(
    useCallback(() => {
      refreshPaymentData();
      if (request?.id) loadRemindersForRequest(request.id);
    }, [refreshPaymentData, loadRemindersForRequest, request?.id])
  );

  // Kept current on every render (not just on focus) so the polling tick
  // below always reads the LATEST status/token, never a value captured when
  // the screen was last focused -- this is what lets it self-terminate the
  // instant a payment lands, with no separate "did status change" effect.
  const latestRequestRef = useRef(request);
  latestRequestRef.current = request;

  // Phase 5A payment hardening: a real Solana payment is verified entirely
  // server-side, and previously the ONLY thing that ever triggered that
  // verification was the payer's own checkout page polling. A merchant
  // sitting on this exact screen had no way to see a payment land until
  // they navigated away and back (re-triggering the focus effect above) or
  // pulled to refresh. This self-rescheduling timer (same pattern as
  // usePublicCheckoutPolling -- setTimeout, never setInterval, so a slow
  // tick can never overlap the next one) closes that gap: while the screen
  // is focused and the request is still open, each tick nudges
  // verify-payment for this one request, then re-reads it from Supabase.
  // Stops the moment the request reaches a terminal status, and stops
  // entirely when the screen loses focus -- never an unbounded interval.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      function scheduleNext() {
        timer = setTimeout(tick, MERCHANT_LIVE_POLL_INTERVAL_MS);
      }

      async function tick() {
        const current = latestRequestRef.current;
        if (!current || (current.status !== 'pending' && current.status !== 'confirming')) return;
        await triggerPaymentVerification(current.publicToken).catch(() => {});
        if (cancelled) return;
        await refreshPaymentData();
        if (cancelled) return;
        scheduleNext();
      }

      scheduleNext();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }, [refreshPaymentData])
  );

  function openManageSheet() {
    setRemindersEnabled(schedule?.enabled ?? true);
    setReminderPreset(schedule?.preset ?? 'standard');
    setCustomReminderRules(schedule?.customRules ?? []);
    setSendHour(schedule?.sendHour ?? 10);
    setSendMinute(schedule?.sendMinute ?? 0);
    if (isManageSheetMounted) manageSheetRef.current?.expand();
    else setIsManageSheetMounted(true);
  }

  function openReminderPresetSheet() {
    if (isReminderPresetSheetMounted) reminderPresetSheetRef.current?.expand();
    else setIsReminderPresetSheetMounted(true);
  }

  function openSendTimeSheet() {
    if (isSendTimeSheetMounted) sendTimeSheetRef.current?.expand();
    else setIsSendTimeSheetMounted(true);
  }

  function openSendNowSheet() {
    if (isSendNowSheetMounted) sendNowSheetRef.current?.expand();
    else setIsSendNowSheetMounted(true);
  }

  function openOverflowSheet() {
    if (isOverflowSheetMounted) overflowSheetRef.current?.expand();
    else setIsOverflowSheetMounted(true);
  }

  useFocusEffect(
    useCallback(() => {
      manageSheetRef.current?.forceClose();
      reminderPresetSheetRef.current?.forceClose();
      sendTimeSheetRef.current?.forceClose();
      sendNowSheetRef.current?.forceClose();
      overflowSheetRef.current?.forceClose();
    }, [])
  );

  async function handleSaveReminders() {
    if (!request || !userId || isSavingReminders) return;
    if (!request.dueAt) return;
    setIsSavingReminders(true);
    try {
      await saveReminderSchedule(userId, request.id, {
        enabled: remindersEnabled,
        preset: reminderPreset,
        customRules: reminderPreset === 'custom' ? customReminderRules : undefined,
        sendHour,
        sendMinute,
        timezone: DEVICE_TIMEZONE,
        dueAt: request.dueAt,
      });
      await recordEvent(request.id, remindersEnabled ? 'reminder_scheduled' : 'reminder_cancelled');
      manageSheetRef.current?.close();
    } catch {
      Alert.alert("Couldn't Save", "We couldn't save your reminder settings. Try again.");
    } finally {
      setIsSavingReminders(false);
    }
  }

  function handleAddCustomRule() {
    const rule: ReminderRule = { type: newRuleDirection, offsetValue: newRuleValue, offsetUnit: newRuleUnit };
    setCustomReminderRules((prev) => addCustomRule(prev, rule));
  }

  async function recordEvent(
    requestId: string,
    type: 'shared' | 'reminder_sent' | 'reminder_scheduled' | 'reminder_cancelled'
  ) {
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

  // A tap on "Send now" opens this action sheet rather than immediately
  // sending -- the merchant picks a real channel (Spero has no automated
  // email/SMS delivery yet, see reminderSchedule's own docs and the Phase
  // 4A report), and every option here genuinely does what it says: no
  // channel is offered that doesn't actually work today.
  function openSendNowActions() {
    if (!request) return;
    if (Date.now() < manualSendCooldownRef.current) return; // spam guard: see MANUAL_SEND_COOLDOWN_MS
    openSendNowSheet();
  }

  async function handleManualSend(channel: 'share' | 'whatsapp' | 'copy_message' | 'copy_link') {
    if (!request || !userId) return;
    sendNowSheetRef.current?.close();
    manualSendCooldownRef.current = Date.now() + MANUAL_SEND_COOLDOWN_MS;
    const message = buildReminderMessage(request, customer);
    const publicLink = getPublicPaymentUrl(request.publicToken);
    try {
      if (channel === 'share') {
        await Share.share({ message });
      } else if (channel === 'whatsapp') {
        await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
      } else if (channel === 'copy_message') {
        await Clipboard.setStringAsync(message);
        Alert.alert('Copied', 'Reminder message copied to clipboard.');
      } else {
        await Clipboard.setStringAsync(publicLink);
        Alert.alert('Copied', 'Payment link copied to clipboard.');
      }
      await useReminderStore.getState().recordManualSend(userId, request.id, channel);
      await recordEvent(request.id, 'reminder_sent');
    } catch {
      // The share sheet/clipboard action itself failing (e.g. the user
      // backed out of the native share dialog) isn't a real failure worth
      // alerting over -- it just means nothing was recorded either.
    }
  }

  const sendNowActions: ActionSheetItem[] = [
    { key: 'share', label: 'Share payment link', icon: 'share-outline', onPress: () => handleManualSend('share') },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', onPress: () => handleManualSend('whatsapp') },
    { key: 'copy_message', label: 'Copy message', icon: 'copy-outline', onPress: () => handleManualSend('copy_message') },
    { key: 'copy_link', label: 'Copy payment link', icon: 'link-outline', onPress: () => handleManualSend('copy_link') },
  ];

  async function handleConfirmCancel() {
    if (!request || !userId || isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelRequest(userId, request.id);
      setCancelModalVisible(false);
    } catch {
      Alert.alert('Couldn\'t Cancel', "We couldn't cancel this request. Check your connection and try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  function handleCreateAgain() {
    if (!request) return;
    prefillDraft({
      amount: String(request.amount),
      currency: request.currency,
      description: request.description,
      customerId: request.customerId,
      expiryOption: request.expiryOption,
      note: request.note,
    });
    router.push('/request/amount');
  }

  async function handleConfirmDelete() {
    if (!request || !userId || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteRequest(userId, request.id);
      setDeleteModalVisible(false);
      router.replace('/(app)/requests');
    } catch {
      Alert.alert('Couldn\'t Delete', "We couldn't delete this request. Check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  // Archived != deleted -- status, payment history, invoice/receipt data,
  // and every identifier stay exactly as they are; only archived_at
  // changes (see requestStore.archiveRequest/restoreRequest). Neither
  // navigates away: the merchant stays on this exact screen, now showing
  // the Archived badge / a Restore action instead.
  async function handleConfirmArchive() {
    if (!request || !userId || isArchiving) return;
    setIsArchiving(true);
    try {
      await archiveRequest(userId, request.id);
      setArchiveModalVisible(false);
    } catch (error) {
      setArchiveModalVisible(false);
      setArchiveActionError({
        title: "Couldn't Archive",
        description: error instanceof Error ? error.message : 'We couldn\'t archive this request. Try again.',
      });
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleConfirmRestore() {
    if (!request || !userId || isRestoring) return;
    setIsRestoring(true);
    try {
      await restoreRequest(userId, request.id);
      setRestoreModalVisible(false);
    } catch (error) {
      setRestoreModalVisible(false);
      setArchiveActionError({
        title: "Couldn't Restore",
        description: error instanceof Error ? error.message : 'We couldn\'t restore this request. Try again.',
      });
    } finally {
      setIsRestoring(false);
    }
  }

  // Overflow menu (spec: "Keep destructive and management actions
  // visually separated from normal payment actions") -- Archive/Restore is
  // a safe, reversible action so it's grouped with the regular actions;
  // Cancel/Delete are destructive and get AppActionSheet's own separated
  // destructive group automatically.
  function openArchiveModalFromOverflow() {
    overflowSheetRef.current?.close();
    setArchiveModalVisible(true);
  }
  function openRestoreModalFromOverflow() {
    overflowSheetRef.current?.close();
    setRestoreModalVisible(true);
  }
  function openCancelModalFromOverflow() {
    overflowSheetRef.current?.close();
    setCancelModalVisible(true);
  }
  function openDeleteModalFromOverflow() {
    overflowSheetRef.current?.close();
    setDeleteModalVisible(true);
  }

  const overflowActions: ActionSheetItem[] = request
    ? [
        request.archivedAt
          ? { key: 'restore', label: 'Restore Request', icon: 'arrow-undo-outline', onPress: openRestoreModalFromOverflow }
          : { key: 'archive', label: 'Archive Request', icon: 'archive-outline', onPress: openArchiveModalFromOverflow },
        ...(request.status === 'pending' || request.status === 'confirming'
          ? [{ key: 'cancel', label: 'Cancel Request', icon: 'close-circle-outline', destructive: true, onPress: openCancelModalFromOverflow } as ActionSheetItem]
          : []),
        ...(request.status === 'expired' || request.status === 'cancelled'
          ? [{ key: 'delete', label: 'Delete Request', icon: 'trash-outline', destructive: true, onPress: openDeleteModalFromOverflow } as ActionSheetItem]
          : []),
      ]
    : [];

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Request" onBackPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="document-text-outline"
            title="We couldn't load this request."
            description="It may still be syncing, or no longer exists."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader
        title="Request Detail"
        onBackPress={() => router.back()}
        rightIcon="ellipsis-horizontal"
        onRightPress={openOverflowSheet}
        rightAccessibilityLabel="More actions"
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: TAB_BAR_CONTENT_HEIGHT + spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refreshPaymentData} />}
      >
        <ThemeAwareCard variant="hero">
          <View style={styles.badgeGroup}>
            <StatusBadge status={request.status} />
            {request.archivedAt ? (
              <View
                style={[
                  styles.archivedBadge,
                  { backgroundColor: colors.heroSurfaceBorder, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, marginLeft: spacing.xs },
                ]}
              >
                <Text style={[typography.caption, { color: colors.heroSurfaceTextMuted }]}>Archived</Text>
              </View>
            ) : null}
          </View>
          <Text style={[typography.bodySmall, { color: colors.heroSurfaceTextMuted, marginTop: spacing.lg }]}>
            Amount
          </Text>
          <View style={[styles.amountRow, { marginTop: spacing.xs }]}>
            <Text style={[typography.heroNumber, { color: colors.heroSurfaceText }]}>
              {formatCurrency(request.amount)}
            </Text>
            <Text style={[typography.h3, { color: colors.heroSurfaceTextMuted, marginLeft: spacing.xs }]}>
              {request.currency}
            </Text>
          </View>
          <View style={[styles.identityRow, { marginTop: spacing.lg, paddingTop: spacing.base, borderTopWidth: 1, borderTopColor: colors.heroSurfaceBorder }]}>
            {customer ? (
              <CustomerAvatar
                name={customer.name}
                color={customer.avatarColor}
                avatarUrl={customer.avatarUrl}
                imageType={customer.imageType}
                size={32}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { width: 32, height: 32, borderRadius: radius.full, borderColor: colors.heroSurfaceBorder },
                ]}
              >
                <Ionicons name="person-outline" size={15} color={colors.heroSurfaceTextMuted} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.heroSurfaceTextMuted }]}>BILLED TO</Text>
              <Text
                style={[typography.bodyMedium, { color: customer ? colors.heroSurfaceText : colors.heroSurfaceTextMuted, marginTop: 1 }]}
                numberOfLines={1}
              >
                {customer?.name ?? 'No customer'}
              </Text>
            </View>
          </View>
        </ThemeAwareCard>

        {/* Secondary compact actions -- one row, never a long stack of
            buttons (spec's Request Detail refinement). QR only shown when
            there's actually a scannable URI to show. */}
        <View style={[styles.compactActionsRow, { marginTop: spacing.lg }]}>
          {solanaPayUri ? (
            <CompactAction icon="qr-code-outline" label="QR" onPress={() => setQrModalVisible(true)} />
          ) : null}
          <CompactAction icon="share-outline" label="Share" onPress={handleShareAgain} />
          <CompactAction icon="document-text-outline" label="Invoice" onPress={() => router.push(`/request/invoice?id=${request.id}`)} />
          {request.status === 'paid' ? (
            <CompactAction icon="receipt-outline" label="Receipt" onPress={() => router.push(`/request/receipt?id=${request.id}`)} />
          ) : null}
        </View>

        {request.description ? (
          <>
            <SectionLabel>DESCRIPTION</SectionLabel>
            <ThemeAwareCard>
              <Text style={[typography.body, { color: colors.textPrimary }]}>{request.description}</Text>
            </ThemeAwareCard>
          </>
        ) : null}

        <SectionLabel>REMINDERS</SectionLabel>
        <ReminderStatusCard
          requestStatus={request.status}
          paidAt={transaction?.paidAt}
          schedule={schedule}
          reminders={reminders}
          onManage={openManageSheet}
          onSendNow={openSendNowActions}
          sendNowDisabled={request.status !== 'pending'}
        />

        {reminders.length > 0 ? (
          <>
            <SectionLabel>REMINDER HISTORY</SectionLabel>
            <ThemeAwareCard>
              {[...reminders]
                .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime())
                .map((reminderItem, index) => {
                  const presentation = reminderStatusPresentation(reminderItem.status);
                  const toneColor =
                    presentation.tone === 'success'
                      ? colors.success
                      : presentation.tone === 'danger'
                        ? colors.error
                        : colors.textMuted;
                  const icon: keyof typeof Ionicons.glyphMap =
                    presentation.tone === 'success'
                      ? 'checkmark-circle'
                      : presentation.tone === 'danger'
                        ? 'warning'
                        : reminderItem.status === 'processing'
                          ? 'sync-outline'
                          : reminderItem.status === 'cancelled'
                            ? 'close-circle-outline'
                            : 'time-outline';
                  const reason =
                    reminderItem.status === 'failed' || reminderItem.status === 'skipped'
                      ? friendlyReminderReason(reminderItem.lastError)
                      : undefined;
                  return (
                    <View
                      key={reminderItem.id}
                      style={[
                        styles.reminderHistoryRow,
                        { marginTop: index === 0 ? 0 : spacing.md, paddingTop: index === 0 ? 0 : spacing.md, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border },
                      ]}
                    >
                      <Ionicons name={icon} size={16} color={toneColor} />
                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{presentation.label}</Text>
                        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                          {formatEventDate(reminderItem.sentAt ?? reminderItem.scheduledFor)}
                        </Text>
                        {reason ? (
                          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>{reason}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
            </ThemeAwareCard>
          </>
        ) : null}

        <SectionLabel>REQUEST</SectionLabel>
        <ThemeAwareCard>
          <DetailRow label="Payment ID" value={request.paymentCode} />
          {request.dueAt ? <DetailRow label="Due" value={formatEventDate(request.dueAt)} /> : null}
          <DetailRow label="Stablecoin & Network" value={`${request.currency} on ${request.network}`} />
          <DetailRow label="Created" value={formatEventDate(request.createdAt)} />
          <DetailRow label="Expiry" value={request.expiresAt ? formatEventDate(request.expiresAt) : 'Never'} last />
        </ThemeAwareCard>

        {wallet || transaction ? (
          <>
            <SectionLabel>PAYMENT</SectionLabel>
            <ThemeAwareCard>
              {wallet ? <DetailRow label="Receiving Wallet" value={truncateHash(wallet.address)} /> : null}
              <DetailRow label="Payment Link" value={getPublicPaymentUrl(request.publicToken)} last={!transaction} />
              {transaction ? <DetailRow label="Paid Date" value={formatEventDate(transaction.paidAt)} /> : null}
              {transaction ? <DetailRow label="Transaction Hash" value={truncateHash(transaction.txHash)} /> : null}
              <ExplorerLinkRow txHash={transaction?.txHash} last />
            </ThemeAwareCard>
          </>
        ) : null}

        {request.allowPartialPayments && accounting ? (
          <>
            <SectionLabel>PAYMENT PROGRESS</SectionLabel>
            <ThemeAwareCard>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {formatCurrency(accounting.verifiedPaidAmount)} / {formatCurrency(accounting.totalAmount)} paid
              </Text>
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: colors.background, borderRadius: radius.full, marginTop: spacing.sm },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, (accounting.verifiedPaidAmount / Math.max(accounting.totalAmount, 0.01)) * 100)}%`,
                      backgroundColor: accounting.isFullyPaid ? colors.success : colors.primaryAction,
                      borderRadius: radius.full,
                    },
                  ]}
                />
              </View>
              <View style={[styles.progressLabelsRow, { marginTop: spacing.xs }]}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {accounting.isFullyPaid ? 'Paid in full' : `Remaining: ${formatCurrency(accounting.remainingAmount)}`}
                </Text>
              </View>

              {requestTransactions.length > 0 ? (
                <View style={{ marginTop: spacing.base }}>
                  {requestTransactions.map((tx, index) => (
                    <View
                      key={tx.id}
                      style={[styles.paymentRow, { marginTop: index === 0 ? 0 : spacing.sm }]}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={[typography.bodySmall, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>
                        {formatCurrency(tx.amount)}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>{formatEventDate(tx.paidAt)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ThemeAwareCard>
          </>
        ) : null}

        <SectionLabel>TIMELINE</SectionLabel>
        <ThemeAwareCard>
          {events.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs }]}>
                No activity recorded yet.
              </Text>
            </View>
          ) : (
            events.map((event, index) => (
              <View key={event.id} style={[styles.timelineRow, { marginTop: index === 0 ? 0 : spacing.md }]}>
                <View
                  style={[
                    styles.timelineIcon,
                    { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.background },
                  ]}
                >
                  <Ionicons name={EVENT_ICONS[event.type]} size={16} color={colors.textSecondary} />
                </View>
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{EVENT_LABELS[event.type]}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{formatEventDate(event.occurredAt)}</Text>
                </View>
              </View>
            ))
          )}
        </ThemeAwareCard>

        {/* Cancel/Delete moved into the overflow menu (spec's Request Detail
            refinement: "Keep destructive and management actions visually
            separated from normal payment actions") -- this section now
            only ever shows the one genuinely distinct primary payment
            action for the current status, when one exists. Pending/
            confirming have no separate primary action of their own
            anymore: Share is already one tap away in the compact actions
            row above, and Cancel lives in the overflow menu. */}
        {request.status === 'confirming' ? (
          <ThemeAwareCard style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="sync-outline" size={24} color={colors.textSecondary} />
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
              Confirming payment on the network…
            </Text>
          </ThemeAwareCard>
        ) : null}

        {request.status === 'expired' || request.status === 'cancelled' ? (
          <View style={{ marginTop: spacing.xl }}>
            <PrimaryButton label="Create Again" onPress={handleCreateAgain} />
          </View>
        ) : null}
      </ScrollView>

      {isManageSheetMounted ? (
        <AppBottomSheet ref={manageSheetRef} initialIndex={0} snapPoints={MANAGE_SHEET_SNAP_POINTS} scrollable>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Manage Reminders</Text>

          {!request.dueAt ? (
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.base }]}>
              This request has no due date, so reminders can't be scheduled for it. Set a due date when creating a new
              request to enable Smart Reminders.
            </Text>
          ) : (
            <>
              <View
                style={[
                  styles.reminderRow,
                  { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base, marginBottom: spacing.base },
                ]}
              >
                <View style={{ flex: 1, marginRight: spacing.md }}>
                  <Text style={[typography.body, { color: colors.textPrimary }]}>Smart reminders</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                    Automatically remind this customer while payment is pending.
                  </Text>
                </View>
                <Switch
                  value={remindersEnabled}
                  onValueChange={setRemindersEnabled}
                  trackColor={{ true: colors.primaryAction, false: colors.border }}
                  thumbColor={colors.surface}
                  accessibilityLabel="Smart reminders"
                />
              </View>

              {remindersEnabled ? (
                <>
                  <View style={{ marginBottom: spacing.base }}>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                      Schedule
                    </Text>
                    <SelectField
                      icon="alarm-outline"
                      label={reminderPreset === 'custom' ? 'Custom' : `${reminderPreset[0].toUpperCase()}${reminderPreset.slice(1)}`}
                      onPress={openReminderPresetSheet}
                    />
                  </View>

                  {reminderPreset === 'custom' ? (
                    <View style={{ marginBottom: spacing.base }}>
                      {customReminderRules.length === 0 ? (
                        <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                          No reminder points yet -- add one below.
                        </Text>
                      ) : (
                        customReminderRules.map((rule, index) => (
                          <View
                            key={`${rule.type}-${rule.offsetValue}-${rule.offsetUnit}`}
                            style={[
                              styles.ruleRow,
                              {
                                borderColor: colors.border,
                                borderRadius: radius.md,
                                padding: spacing.sm,
                                marginBottom: spacing.xs,
                              },
                            ]}
                          >
                            <Ionicons name="checkmark-circle" size={16} color={colors.primaryAction} />
                            <Text style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
                              {reminderRuleLabel(rule)}
                            </Text>
                            <Pressable
                              onPress={() => setCustomReminderRules((prev) => prev.filter((_, i) => i !== index))}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${reminderRuleLabel(rule)}`}
                            >
                              <Ionicons name="close" size={18} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        ))
                      )}

                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs }]}>
                        Add reminder
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Pressable
                          onPress={() => setNewRuleValue((v) => Math.max(1, v - 1))}
                          style={[styles.stepperButton, { borderColor: colors.border, borderRadius: radius.md }]}
                          accessibilityRole="button"
                          accessibilityLabel="Decrease"
                        >
                          <Ionicons name="remove" size={16} color={colors.textPrimary} />
                        </Pressable>
                        <Text style={[typography.bodyMedium, { color: colors.textPrimary, minWidth: 24, textAlign: 'center' }]}>
                          {newRuleValue}
                        </Text>
                        <Pressable
                          onPress={() => setNewRuleValue((v) => Math.min(60, v + 1))}
                          style={[styles.stepperButton, { borderColor: colors.border, borderRadius: radius.md }]}
                          accessibilityRole="button"
                          accessibilityLabel="Increase"
                        >
                          <Ionicons name="add" size={16} color={colors.textPrimary} />
                        </Pressable>
                        <Pressable
                          onPress={() => setNewRuleUnit(newRuleUnit === 'days' ? 'weeks' : 'days')}
                          style={[styles.chip, { borderColor: colors.border, borderRadius: radius.full }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Unit: ${newRuleUnit}`}
                        >
                          <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>
                            {newRuleValue === 1 ? newRuleUnit.slice(0, -1) : newRuleUnit}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setNewRuleDirection(newRuleDirection === 'before_due' ? 'after_due' : 'before_due')}
                          style={[styles.chip, { borderColor: colors.border, borderRadius: radius.full, flex: 1 }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Timing: ${newRuleDirection === 'before_due' ? 'before due date' : 'after due date'}`}
                        >
                          <Text style={[typography.bodySmall, { color: colors.textPrimary, textAlign: 'center' }]}>
                            {newRuleDirection === 'before_due' ? 'Before due date' : 'After due date'}
                          </Text>
                        </Pressable>
                      </View>
                      <View style={{ marginTop: spacing.sm }}>
                        <SecondaryButton label="+ Add reminder" onPress={handleAddCustomRule} />
                      </View>
                    </View>
                  ) : (
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.base }]}>
                      Reminders will be sent {reminderScheduleSummary(rulesForPreset(reminderPreset, undefined)).toLowerCase()}.
                    </Text>
                  )}

                  <View style={{ marginBottom: spacing.base }}>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                      Send around
                    </Text>
                    <SelectField
                      icon="time-outline"
                      label={SEND_TIME_OPTIONS.find((t) => t.hour === sendHour && t.minute === sendMinute)?.label ?? '10:00 AM'}
                      onPress={openSendTimeSheet}
                    />
                  </View>
                </>
              ) : null}

              {remindersEnabled ? (
                <View style={{ marginBottom: spacing.base }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                    Message preview
                  </Text>
                  <View
                    style={[
                      styles.previewCard,
                      { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.base },
                    ]}
                  >
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {buildAutomaticReminderMessage(
                        'on_due',
                        request,
                        customer,
                        request.allowPartialPayments ? accounting?.remainingAmount : undefined
                      )}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View
                style={[
                  styles.infoRow,
                  { backgroundColor: colors.softBlue, borderRadius: radius.md, padding: spacing.base, marginBottom: spacing.lg },
                ]}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.softBlueText} />
                <Text style={[typography.caption, { color: colors.softBlueText, flex: 1, marginLeft: spacing.sm }]}>
                  Reminders always stop automatically as soon as this request is paid.
                </Text>
              </View>

              <PrimaryButton label="Save Changes" onPress={handleSaveReminders} loading={isSavingReminders} />
            </>
          )}
        </AppBottomSheet>
      ) : null}

      {isReminderPresetSheetMounted ? (
        <ReminderPresetSheet
          ref={reminderPresetSheetRef}
          initialIndex={0}
          value={reminderPreset}
          onSelect={(preset) => {
            setReminderPreset(preset);
            reminderPresetSheetRef.current?.close();
          }}
        />
      ) : null}

      {isSendTimeSheetMounted ? (
        <AppBottomSheet ref={sendTimeSheetRef} initialIndex={0} snapPoints={SEND_TIME_SHEET_SNAP_POINTS}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Send around</Text>
          {SEND_TIME_OPTIONS.map((option) => {
            const selected = option.hour === sendHour && option.minute === sendMinute;
            return (
              <Pressable
                key={option.label}
                onPress={() => {
                  setSendHour(option.hour);
                  setSendMinute(option.minute);
                  sendTimeSheetRef.current?.close();
                }}
                style={[styles.optionRow, { paddingVertical: spacing.md }]}
              >
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
                {selected ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
              </Pressable>
            );
          })}
        </AppBottomSheet>
      ) : null}

      {isSendNowSheetMounted ? (
        <AppActionSheet ref={sendNowSheetRef} initialIndex={0} title="Send reminder" actions={sendNowActions} />
      ) : null}

      {isOverflowSheetMounted ? (
        <AppActionSheet ref={overflowSheetRef} initialIndex={0} title="More actions" actions={overflowActions} />
      ) : null}

      <FullScreenQRModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        solanaPayUri={solanaPayUri}
        amount={request.amount}
        currency={request.currency}
        merchantName={profile?.businessName?.trim() || profile?.displayName?.trim() || undefined}
        walletAddress={wallet?.address}
        publicLink={getPublicPaymentUrl(request.publicToken)}
      />

      <ConfirmationModal
        visible={cancelModalVisible}
        title="Cancel this request?"
        description="The customer will no longer be able to pay this request. This can't be undone."
        confirmLabel="Cancel Request"
        cancelLabel="Keep Request"
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelModalVisible(false)}
        loading={isCancelling}
        icon="close-circle-outline"
      />

      <ConfirmationModal
        visible={deleteModalVisible}
        title="Delete this request?"
        description="This will permanently remove the request from your history. This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
        loading={isDeleting}
      />

      <ConfirmationModal
        visible={archiveModalVisible}
        title="Archive request?"
        description="This request will be moved out of your main list. You can restore it anytime."
        confirmLabel="Archive"
        cancelLabel="Cancel"
        onConfirm={handleConfirmArchive}
        onCancel={() => setArchiveModalVisible(false)}
        loading={isArchiving}
        icon="archive-outline"
      />

      <ConfirmationModal
        visible={restoreModalVisible}
        title="Restore request?"
        description="This request will return to your active request history."
        confirmLabel="Restore"
        cancelLabel="Cancel"
        onConfirm={handleConfirmRestore}
        onCancel={() => setRestoreModalVisible(false)}
        loading={isRestoring}
        icon="arrow-undo-outline"
      />

      <AppMessageModal
        visible={!!archiveActionError}
        title={archiveActionError?.title ?? ''}
        description={archiveActionError?.description ?? ''}
        actionLabel="OK"
        onDismiss={() => setArchiveActionError(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  badgeGroup: { flexDirection: 'row', alignItems: 'center' },
  archivedBadge: { alignSelf: 'flex-start' },
  compactActionsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  compactAction: { alignItems: 'center', flex: 1 },
  compactActionIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  timelineRow: { flexDirection: 'row', alignItems: 'center' },
  timelineIcon: { alignItems: 'center', justifyContent: 'center' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  stepperButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  previewCard: {},
  progressTrack: { height: 8, overflow: 'hidden' },
  progressFill: { height: '100%' },
  progressLabelsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  paymentRow: { flexDirection: 'row', alignItems: 'center' },
  reminderHistoryRow: { flexDirection: 'row', alignItems: 'flex-start' },
});
