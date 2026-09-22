import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { TextButton } from '../../src/components/TextButton';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { ReminderPresetSheet } from '../../src/components/ReminderPresetSheet';
import { CustomerAvatar } from '../../src/components/CustomerAvatar';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useTemplateStore } from '../../src/store/templateStore';
import { useReminderStore } from '../../src/store/reminderStore';
import { useRequestEventStore } from '../../src/store/requestEventStore';
import { useAuthStore } from '../../src/store/authStore';
import { supabase } from '../../src/lib/supabase';
import { isValidEmail } from '../../src/utils/validators';
import { reminderScheduleSummary, rulesForPreset } from '../../src/utils/reminderSchedule';
import { requestDebugLog } from '../../src/utils/requestDebugLog';
import type { ExpiryOption } from '../../src/types';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
];

// A due date is what makes reminders schedulable at all -- kept as a short
// list of relative offsets (matching the existing Expiry picker's own
// pattern) rather than a full calendar widget, since no date-picker
// dependency exists in this app yet and the spec explicitly asks this
// screen to stay compact.
const DUE_DATE_OPTIONS: { days: number | null; label: string }[] = [
  { days: null, label: 'No due date' },
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'In 7 days' },
  { days: 14, label: 'In 14 days' },
  { days: 30, label: 'In 30 days' },
];

const DEVICE_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Purely presentational: animates the deposit-requirement area sliding in/
// out when "Allow partial payments" or the deposit type is toggled, rather
// than the fields just appearing/disappearing abruptly. Never wraps a state
// change that affects request-creation logic itself.
function animateLayoutChange() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function computeDueAt(days: number): string {
  const target = new Date();
  target.setDate(target.getDate() + days);
  target.setHours(23, 59, 0, 0);
  return target.toISOString();
}

export default function DetailsScreen() {
  const { colors, spacing, radius, typography } = useTheme();

  const amount = useRequestDraftStore((state) => state.amount);
  const currency = useRequestDraftStore((state) => state.currency);
  const description = useRequestDraftStore((state) => state.description);
  const setDescription = useRequestDraftStore((state) => state.setDescription);
  const customerId = useRequestDraftStore((state) => state.customerId);
  const setCustomerId = useRequestDraftStore((state) => state.setCustomerId);
  const expiryOption = useRequestDraftStore((state) => state.expiryOption);
  const setExpiryOption = useRequestDraftStore((state) => state.setExpiryOption);
  const note = useRequestDraftStore((state) => state.note);
  const setNote = useRequestDraftStore((state) => state.setNote);
  const setLastCreatedRequestId = useRequestDraftStore((state) => state.setLastCreatedRequestId);
  const resetDraft = useRequestDraftStore((state) => state.reset);
  const sourceTemplateId = useRequestDraftStore((state) => state.sourceTemplateId);
  const dueAt = useRequestDraftStore((state) => state.dueAt);
  const setDueAt = useRequestDraftStore((state) => state.setDueAt);
  const remindersEnabled = useRequestDraftStore((state) => state.remindersEnabled);
  const setRemindersEnabled = useRequestDraftStore((state) => state.setRemindersEnabled);
  const reminderPreset = useRequestDraftStore((state) => state.reminderPreset);
  const setReminderPreset = useRequestDraftStore((state) => state.setReminderPreset);
  const reminderCustomRules = useRequestDraftStore((state) => state.reminderCustomRules);
  const allowPartialPayments = useRequestDraftStore((state) => state.allowPartialPayments);
  const setAllowPartialPayments = useRequestDraftStore((state) => state.setAllowPartialPayments);
  const depositType = useRequestDraftStore((state) => state.depositType);
  const setDepositType = useRequestDraftStore((state) => state.setDepositType);
  const depositValue = useRequestDraftStore((state) => state.depositValue);
  const setDepositValue = useRequestDraftStore((state) => state.setDepositValue);

  const customers = useCustomerStore((state) => state.customers);
  const addCustomer = useCustomerStore((state) => state.addCustomer);
  const createRequest = useRequestStore((state) => state.createRequest);
  const isCreating = useRequestStore((state) => state.isCreating);
  const saveReminderSchedule = useReminderStore((state) => state.saveSchedule);
  const userId = useAuthStore((state) => state.user?.id);

  const customerSheetRef = useRef<BottomSheet>(null);
  const expirySheetRef = useRef<BottomSheet>(null);
  const dueDateSheetRef = useRef<BottomSheet>(null);
  const reminderPresetSheetRef = useRef<BottomSheet>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerNameError, setNewCustomerNameError] = useState<string | undefined>();
  const [newCustomerEmailError, setNewCustomerEmailError] = useState<string | undefined>();
  const [isSavingNewCustomer, setIsSavingNewCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  // Mirrors the picked preset from DUE_DATE_OPTIONS purely for display --
  // dueAt itself (the ISO instant, in the draft store) is what's actually
  // submitted, this is never reverse-derived from it.
  const [dueDateDays, setDueDateDays] = useState<number | null>(null);

  // Neither sheet is rendered at all until first opened -- see
  // request/amount.tsx for why this is the correct fix: gorhom's imperative
  // .expand() silently no-ops if called before native layout resolves,
  // which an always-mounted sheet's first .expand() call can race.
  // AppBottomSheet's `initialIndex` prop is the layout-aware, declarative
  // alternative used on first mount below.
  const [isCustomerSheetMounted, setIsCustomerSheetMounted] = useState(false);
  const [isExpirySheetMounted, setIsExpirySheetMounted] = useState(false);
  const [isDueDateSheetMounted, setIsDueDateSheetMounted] = useState(false);
  const [isReminderPresetSheetMounted, setIsReminderPresetSheetMounted] = useState(false);

  function openCustomerSheet() {
    setCustomerSearch('');
    setIsAddingCustomer(false);
    if (isCustomerSheetMounted) {
      customerSheetRef.current?.expand();
    } else {
      setIsCustomerSheetMounted(true);
    }
  }

  function openExpirySheet() {
    if (isExpirySheetMounted) {
      expirySheetRef.current?.expand();
    } else {
      setIsExpirySheetMounted(true);
    }
  }

  function openDueDateSheet() {
    if (isDueDateSheetMounted) {
      dueDateSheetRef.current?.expand();
    } else {
      setIsDueDateSheetMounted(true);
    }
  }

  function openReminderPresetSheet() {
    if (isReminderPresetSheetMounted) {
      reminderPresetSheetRef.current?.expand();
    } else {
      setIsReminderPresetSheetMounted(true);
    }
  }

  function handleSelectDueDate(days: number | null) {
    setDueDateDays(days);
    if (days === null) {
      setDueAt(undefined);
      setRemindersEnabled(false);
    } else {
      setDueAt(computeDueAt(days));
    }
    dueDateSheetRef.current?.close();
  }

  // Defense in depth for a reused/backgrounded screen instance whose sheet
  // was left open from an earlier visit.
  useFocusEffect(
    useCallback(() => {
      customerSheetRef.current?.forceClose();
      expirySheetRef.current?.forceClose();
      dueDateSheetRef.current?.forceClose();
      reminderPresetSheetRef.current?.forceClose();
    }, [])
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const expiryLabel = EXPIRY_OPTIONS.find((opt) => opt.value === expiryOption)?.label ?? '7 days';
  const dueDateLabel = DUE_DATE_OPTIONS.find((opt) => opt.days === dueDateDays)?.label ?? 'No due date';

  const filteredCustomers = useMemo(() => {
    const trimmed = customerSearch.trim().toLowerCase();
    if (trimmed.length === 0) return customers;
    return customers.filter((c) => [c.name, c.email, c.company].some((value) => value?.toLowerCase().includes(trimmed)));
  }, [customers, customerSearch]);

  function handleSelectCustomer(id: string) {
    setCustomerId(id);
    customerSheetRef.current?.close();
  }

  async function handleAddCustomer() {
    if (isSavingNewCustomer) return;
    const nextNameError = newCustomerName.trim().length === 0 ? 'Enter a name' : undefined;
    const nextEmailError = !isValidEmail(newCustomerEmail) ? 'Enter a valid email' : undefined;
    setNewCustomerNameError(nextNameError);
    setNewCustomerEmailError(nextEmailError);
    if (nextNameError || nextEmailError || !userId) return;

    setIsSavingNewCustomer(true);
    try {
      const customer = await addCustomer(userId, { name: newCustomerName.trim(), email: newCustomerEmail.trim() });
      setCustomerId(customer.id);
      setNewCustomerName('');
      setNewCustomerEmail('');
      setNewCustomerNameError(undefined);
      setNewCustomerEmailError(undefined);
      setIsAddingCustomer(false);
      customerSheetRef.current?.close();
    } catch {
      // addCustomer already set a calm store-level error; the sheet stays
      // open with the entered values intact so the user can retry.
    } finally {
      setIsSavingNewCustomer(false);
    }
  }

  async function handleCreateRequest() {
    if (isCreating || !userId) return;
    requestDebugLog('handleCreateRequest: submitting', {
      userId,
      amount,
      hasCustomer: !!customerId,
      expiryOption,
      hasDueAt: !!dueAt,
      allowPartialPayments,
    });
    try {
      const request = await createRequest(userId, {
        amount: Number(amount),
        currency,
        description: description.trim() || undefined,
        customerId,
        expiryOption,
        note: note.trim() || undefined,
        dueAt,
        allowPartialPayments,
        depositType: allowPartialPayments ? depositType : undefined,
        depositValue: allowPartialPayments ? depositValue : undefined,
      });
      setLastCreatedRequestId(request.id);
      // Reset immediately on success, not only when the user later taps the
      // X on the "created" screen (previously the only reset point) --
      // that left the draft carrying the just-created request's amount,
      // customer, due date, reminder settings, and partial-payment/deposit
      // config into a NEW draft whenever the merchant instead used the
      // hardware/gesture back button to start another request, which is a
      // completely ordinary way to navigate. `request` itself (the row just
      // returned from Supabase, with its own fresh id/public_token/solana
      // reference) and every local const captured above (dueAt,
      // remindersEnabled, reminderPreset, reminderCustomRules,
      // sourceTemplateId) already hold this render's snapshotted values, so
      // resetting the store here does not affect the reminder-scheduling or
      // template-usage calls immediately below.
      resetDraft();
      if (sourceTemplateId) {
        // Fire-and-forget: only counts a "use" once a request is actually
        // created (never on a bare "Use Template" tap), but a failure here
        // must never block or affect navigation to the just-created request.
        useTemplateStore.getState().recordUsage(userId, sourceTemplateId);
      }
      if (dueAt && remindersEnabled) {
        // Fire-and-forget for the same reason as recordUsage above: the
        // request itself was already created successfully, so a reminder-
        // scheduling failure must never block navigation to it. The merchant
        // can always turn reminders on from Request Detail if this silently
        // didn't take.
        saveReminderSchedule(userId, request.id, {
          enabled: true,
          preset: reminderPreset,
          customRules: reminderPreset === 'custom' ? reminderCustomRules : undefined,
          sendHour: 10,
          sendMinute: 0,
          timezone: DEVICE_TIMEZONE,
          dueAt,
        })
          .then(async () => {
            const { data, error } = await supabase
              .from('request_events')
              .insert({ user_id: userId, payment_request_id: request.id, event_type: 'reminder_scheduled' })
              .select('*')
              .single();
            if (!error && data) {
              useRequestEventStore
                .getState()
                .addLocal({ id: data.id, requestId: data.payment_request_id, type: data.event_type, occurredAt: data.occurred_at });
            }
          })
          .catch(() => {
            // Swallowed deliberately -- see the fire-and-forget comment above.
          });
      }
      router.replace(`/request/created?id=${request.id}`);
    } catch (error) {
      requestDebugLog('handleCreateRequest: create failed, showing alert', {
        message: error instanceof Error ? error.message : String(error),
        code: (error as { code?: string })?.code,
      });
      // __DEV__ only: shows the actual Postgres/PostgREST error text right
      // in the alert, not just the console -- a temporary diagnostic so a
      // live-device failure can be read directly off the screen without
      // needing Metro/terminal access. Production keeps the calm, generic
      // message.
      const devDetail =
        __DEV__ && error && typeof error === 'object'
          ? `\n\n[dev] ${(error as { code?: string }).code ?? 'no code'}: ${(error as { message?: string }).message ?? String(error)}`
          : '';
      Alert.alert('Something went wrong', `We couldn't create this request. Check your connection and try again.${devDetail}`);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Request Details" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={[typography.caption, styles.eyebrow, { color: colors.textMuted, marginBottom: spacing.sm }]}>PAYMENT</Text>
            <ThemeAwareCard>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Amount</Text>
                  <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                    {Number(amount).toFixed(2)} <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{currency}</Text>
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Network</Text>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>Solana</Text>
                </View>
              </View>
            </ThemeAwareCard>
          </View>

          <TextField
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What is this payment for?"
            returnKeyType="done"
          />

          <View>
            <Text style={[typography.caption, styles.eyebrow, { color: colors.textMuted, marginBottom: spacing.sm }]}>CUSTOMER</Text>
            <Pressable
              onPress={openCustomerSheet}
              style={({ pressed }) => [
                styles.pickerRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.base,
                  paddingVertical: spacing.md,
                  minHeight: 52,
                  opacity: pressed ? 0.85 : 1,
                },
                styles.cardShadow,
              ]}
              accessibilityRole="button"
              accessibilityLabel={selectedCustomer ? `Customer: ${selectedCustomer.name}` : 'Select a customer'}
            >
              {selectedCustomer ? (
                <>
                  <CustomerAvatar
                    name={selectedCustomer.name}
                    color={selectedCustomer.avatarColor}
                    avatarUrl={selectedCustomer.avatarUrl}
                    imageType={selectedCustomer.imageType}
                    size={36}
                  />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                      {selectedCustomer.name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {selectedCustomer.email}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={[typography.body, { color: colors.textMuted, flex: 1 }]}>Select a customer (optional)</Text>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <View>
            <Text style={[typography.caption, styles.eyebrow, { color: colors.textMuted, marginBottom: spacing.sm }]}>SCHEDULE</Text>
            <View style={{ gap: spacing.sm }}>
              <View>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>Expires In</Text>
                <SelectField icon="time-outline" label={expiryLabel} onPress={openExpirySheet} accessibilityLabel={`Expires in: ${expiryLabel}`} />
              </View>
              <View>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>Due Date (Optional)</Text>
                <SelectField
                  icon="calendar-outline"
                  label={dueDateLabel}
                  onPress={openDueDateSheet}
                  isPlaceholder={dueDateDays === null}
                  accessibilityLabel={`Due date: ${dueDateLabel}`}
                />
              </View>
            </View>
          </View>

          {dueAt ? (
            <View>
              <Text style={[typography.caption, styles.eyebrow, { color: colors.textMuted, marginBottom: spacing.sm }]}>REMINDERS</Text>
              <ThemeAwareCard>
                <View style={styles.toggleHeaderRow}>
                  <View style={[styles.iconChip, { backgroundColor: colors.primaryActionSoft, borderRadius: radius.md }]}>
                    <Ionicons name="notifications-outline" size={17} color={colors.textPrimary} />
                  </View>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1, marginLeft: spacing.md }]}>
                    Payment reminders
                  </Text>
                  <Switch
                    value={remindersEnabled}
                    onValueChange={setRemindersEnabled}
                    trackColor={{ true: colors.primaryAction, false: colors.border }}
                    thumbColor={colors.surface}
                    accessibilityLabel="Payment reminders"
                  />
                </View>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                  Automatically remind this customer if payment is still pending.
                </Text>

                {remindersEnabled ? (
                  <View
                    style={[
                      styles.expandedSection,
                      { marginTop: spacing.base, paddingTop: spacing.base, borderTopColor: colors.border },
                    ]}
                  >
                    <View style={styles.reminderSummaryRow}>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]} numberOfLines={2}>
                        {reminderScheduleSummary(rulesForPreset(reminderPreset, reminderCustomRules))}
                      </Text>
                      <TextButton label="Customize" onPress={openReminderPresetSheet} />
                    </View>
                  </View>
                ) : null}
              </ThemeAwareCard>
            </View>
          ) : null}

          <View>
            <Text style={[typography.caption, styles.eyebrow, { color: colors.textMuted, marginBottom: spacing.sm }]}>PAYMENT OPTIONS</Text>
            <ThemeAwareCard>
              <View style={styles.toggleHeaderRow}>
                <View style={[styles.iconChip, { backgroundColor: colors.primaryActionSoft, borderRadius: radius.md }]}>
                  <Ionicons name="layers-outline" size={17} color={colors.textPrimary} />
                </View>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1, marginLeft: spacing.md }]}>
                  Allow partial payments
                </Text>
                <Switch
                  value={allowPartialPayments}
                  onValueChange={(value) => {
                    animateLayoutChange();
                    setAllowPartialPayments(value);
                    if (!value) {
                      setDepositType(undefined);
                      setDepositValue(undefined);
                    }
                  }}
                  trackColor={{ true: colors.primaryAction, false: colors.border }}
                  thumbColor={colors.surface}
                  accessibilityLabel="Allow partial payments"
                />
              </View>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                Let this customer pay in more than one transaction, instead of requiring the full amount at once.
              </Text>

              {allowPartialPayments ? (
                <View
                  style={[
                    styles.expandedSection,
                    { marginTop: spacing.base, paddingTop: spacing.base, borderTopColor: colors.border },
                  ]}
                >
                  <Text style={[typography.caption, styles.eyebrowSecondary, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                    DEPOSIT REQUIREMENT
                  </Text>
                  <View style={[styles.chipRow, { gap: spacing.sm }]}>
                    {(['none', 'fixed', 'percentage'] as const).map((option) => {
                      const selected = option === 'none' ? !depositType : depositType === option;
                      const optionLabel = option === 'none' ? 'No deposit' : option === 'fixed' ? 'Fixed amount' : 'Percentage';
                      return (
                        <Pressable
                          key={option}
                          onPress={() => {
                            animateLayoutChange();
                            if (option === 'none') {
                              setDepositType(undefined);
                              setDepositValue(undefined);
                            } else {
                              setDepositType(option);
                            }
                          }}
                          style={[
                            styles.depositChip,
                            {
                              borderColor: selected ? colors.primaryAction : colors.border,
                              borderWidth: selected ? 1.5 : 1,
                              backgroundColor: selected ? colors.softMint : colors.background,
                              borderRadius: radius.full,
                              paddingHorizontal: spacing.md,
                              paddingVertical: spacing.sm,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={optionLabel}
                          accessibilityState={{ selected }}
                        >
                          {selected ? (
                            <Ionicons name="checkmark-circle" size={14} color={colors.softMintText} style={{ marginRight: spacing.xs / 2 }} />
                          ) : null}
                          <Text
                            style={[typography.bodySmall, { color: selected ? colors.softMintText : colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {optionLabel}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {depositType ? (
                    <View style={{ marginTop: spacing.base }}>
                      <TextField
                        label={depositType === 'fixed' ? `Deposit amount (${currency})` : 'Deposit percentage'}
                        value={depositValue != null ? String(depositValue) : ''}
                        onChangeText={(text) => {
                          const parsed = Number(text);
                          setDepositValue(text.trim().length > 0 && !Number.isNaN(parsed) ? parsed : undefined);
                        }}
                        keyboardType="decimal-pad"
                        placeholder={depositType === 'fixed' ? 'e.g. 300' : 'e.g. 30'}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ThemeAwareCard>
          </View>

          <TextField
            label="Note to Customer (Optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Add an optional note"
            multiline
          />
        </ScrollView>
        <View
          style={[
            styles.footer,
            { paddingHorizontal: spacing.xl, paddingTop: spacing.base, paddingBottom: spacing.lg, borderTopColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <PrimaryButton label="Create Request" onPress={handleCreateRequest} loading={isCreating} />
        </View>
      </KeyboardAvoidingView>

      {isCreating ? (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.background }]}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Creating your request...</Text>
        </View>
      ) : null}

      {isCustomerSheetMounted ? (
        <AppBottomSheet ref={customerSheetRef} initialIndex={0} scrollable>
          {isAddingCustomer ? (
            <>
              <View style={[styles.sheetHeaderRow, { marginBottom: spacing.md }]}>
                <Pressable
                  onPress={() => setIsAddingCustomer(false)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Back to customer list"
                >
                  <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                </Pressable>
                <Text style={[typography.h3, { color: colors.textPrimary, marginLeft: spacing.sm }]}>New Customer</Text>
              </View>
              <TextField
                label="Name"
                value={newCustomerName}
                onChangeText={setNewCustomerName}
                error={newCustomerNameError}
                placeholder="Customer name"
                autoCapitalize="words"
                returnKeyType="next"
              />
              <TextField
                label="Email"
                value={newCustomerEmail}
                onChangeText={setNewCustomerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={newCustomerEmailError}
                placeholder="name@example.com"
                returnKeyType="done"
                onSubmitEditing={handleAddCustomer}
              />
              <PrimaryButton label="Add Customer" onPress={handleAddCustomer} loading={isSavingNewCustomer} />
            </>
          ) : (
            <>
              <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Select Customer</Text>
              {customers.length > 5 ? (
                <View
                  style={[
                    styles.sheetSearchRow,
                    { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
                  ]}
                >
                  <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    placeholder="Search customers"
                    placeholderTextColor={colors.textMuted}
                    style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}
                    accessibilityLabel="Search customers"
                  />
                </View>
              ) : null}
              {filteredCustomers.length === 0 ? (
                <Text style={[typography.bodySmall, { color: colors.textMuted, paddingVertical: spacing.md }]}>
                  {customers.length === 0 ? 'No customers yet.' : `No customers match "${customerSearch}".`}
                </Text>
              ) : (
                filteredCustomers.map((customer) => {
                  const isSelected = customer.id === customerId;
                  return (
                    <Pressable
                      key={customer.id}
                      onPress={() => handleSelectCustomer(customer.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={({ pressed }) => [
                        styles.customerRow,
                        {
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.sm,
                          borderRadius: radius.md,
                          backgroundColor: isSelected ? colors.softMint : pressed ? colors.background : 'transparent',
                        },
                      ]}
                    >
                      <CustomerAvatar
                        name={customer.name}
                        color={customer.avatarColor}
                        avatarUrl={customer.avatarUrl}
                        imageType={customer.imageType}
                        size={36}
                      />
                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                          {customer.name}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                          {customer.email}
                        </Text>
                      </View>
                      {isSelected ? <Ionicons name="checkmark-circle" size={20} color={colors.softMintText} /> : null}
                    </Pressable>
                  );
                })
              )}
              <View style={[styles.sheetDivider, { backgroundColor: colors.border, marginVertical: spacing.sm }]} />
              <Pressable
                onPress={() => setIsAddingCustomer(true)}
                accessibilityRole="button"
                accessibilityLabel="Add new customer"
                style={({ pressed }) => [
                  styles.customerRow,
                  { paddingVertical: spacing.md, borderRadius: radius.md, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.addIconCircle,
                    { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.heroSurface },
                  ]}
                >
                  <Ionicons name="add" size={20} color={colors.heroSurfaceText} />
                </View>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                  Add new customer
                </Text>
              </Pressable>
            </>
          )}
        </AppBottomSheet>
      ) : null}

      {isExpirySheetMounted ? (
        <AppBottomSheet ref={expirySheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Expires In</Text>
          {EXPIRY_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                setExpiryOption(option.value);
                expirySheetRef.current?.close();
              }}
              style={[styles.customerRow, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
              {expiryOption === option.value ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          ))}
        </AppBottomSheet>
      ) : null}

      {isDueDateSheetMounted ? (
        <AppBottomSheet ref={dueDateSheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Due Date</Text>
          {DUE_DATE_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              onPress={() => handleSelectDueDate(option.days)}
              style={[styles.customerRow, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
              {dueDateDays === option.days ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          ))}
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
    </SafeAreaView>
  );
}

const ICON_CHIP_SIZE = 36;

const styles = StyleSheet.create({
  customerRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  overlay: { alignItems: 'center', justifyContent: 'center' },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  sheetSearchRow: { flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1 },
  sheetDivider: { height: 1 },
  addIconCircle: { alignItems: 'center', justifyContent: 'center' },
  // Section eyebrow labels ("PAYMENT", "SCHEDULE", etc.) -- a touch of
  // letter-spacing is what makes a small uppercase caption read as a
  // deliberate section label rather than body text that happens to be
  // capitalized.
  eyebrow: { letterSpacing: 0.6 },
  eyebrowSecondary: { letterSpacing: 0.4 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  // Mirrors ThemeAwareCard's own shadow exactly, for the one row on this
  // screen (the customer picker) that needs the card treatment but can't
  // use ThemeAwareCard directly (it's a Pressable with its own pressed-
  // state opacity, not a plain View).
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconChip: { width: ICON_CHIP_SIZE, height: ICON_CHIP_SIZE, alignItems: 'center', justifyContent: 'center' },
  toggleHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  expandedSection: { borderTopWidth: 1 },
  reminderSummaryRow: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  depositChip: { flexDirection: 'row', alignItems: 'center' },
  footer: { borderTopWidth: 1 },
});
