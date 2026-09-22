import { useCallback, useRef, useState, type RefObject } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SelectField } from '../../src/components/SelectField';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { ReminderPresetSheet } from '../../src/components/ReminderPresetSheet';
import { CurrencySelectSheet } from '../../src/components/CurrencySelectSheet';
import { CustomerAvatar } from '../../src/components/CustomerAvatar';
import { useCustomerStore } from '../../src/store/customerStore';
import { useRecurringPlanStore } from '../../src/store/recurringPlanStore';
import { useAuthStore } from '../../src/store/authStore';
import { usePaymentDefaultsStore } from '../../src/store/paymentDefaultsStore';
import { getZonedDateParts } from '../../src/utils/reminderSchedule';
import { recurringFrequencyLabel } from '../../src/utils/recurringSchedule';
import { isSupportedAsset, type AssetSymbol } from '../../src/config/assets';
import type { RecurringFrequency, ReminderPreset, DepositType } from '../../src/types';

const DEVICE_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const FREQUENCY_OPTIONS: RecurringFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'];

const START_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: 'Today' },
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'In 7 days' },
];

const DUE_OFFSET_OPTIONS: { days: number | null; label: string }[] = [
  { days: null, label: 'No due date' },
  { days: 0, label: 'Same day' },
  { days: 3, label: '3 days after' },
  { days: 7, label: '7 days after' },
];

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CreateRecurringPlanScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const params = useLocalSearchParams<{ templateId?: string; amount?: string; currency?: string; description?: string; reminderPreset?: string }>();
  const userId = useAuthStore((state) => state.user?.id);
  const customers = useCustomerStore((state) => state.customers);
  const createPlan = useRecurringPlanStore((state) => state.createPlan);
  const defaultCurrency = usePaymentDefaultsStore((state) => state.defaultCurrency);

  // Lazy initializers so a template's values (passed as route params by
  // "Make recurring") seed this screen once on first mount -- editing a
  // template afterward never reaches back into an already-open create
  // screen, which is exactly the "snapshot, not a live link" behavior the
  // spec requires.
  const [amount, setAmount] = useState(() => params.amount ?? '');
  const [currency, setCurrency] = useState<AssetSymbol>(() =>
    isSupportedAsset(params.currency) ? params.currency : defaultCurrency
  );
  const [description, setDescription] = useState(() => params.description ?? '');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [customIntervalDays, setCustomIntervalDays] = useState(30);
  const [startOffsetDays, setStartOffsetDays] = useState(0);
  const [endMode, setEndMode] = useState<'none' | 'occurrences'>('none');
  const [maxOccurrences, setMaxOccurrences] = useState(12);
  const [dueDateOffsetDays, setDueDateOffsetDays] = useState<number | null>(7);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>(() => (params.reminderPreset as ReminderPreset) ?? 'standard');
  const [allowPartialPayments, setAllowPartialPayments] = useState(false);
  const [depositType, setDepositType] = useState<DepositType | undefined>();
  const [depositValue, setDepositValue] = useState<number | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  const customerSheetRef = useRef<BottomSheet>(null);
  const frequencySheetRef = useRef<BottomSheet>(null);
  const startSheetRef = useRef<BottomSheet>(null);
  const dueOffsetSheetRef = useRef<BottomSheet>(null);
  const reminderPresetSheetRef = useRef<BottomSheet>(null);
  const currencySheetRef = useRef<BottomSheet>(null);
  const [isCustomerSheetMounted, setIsCustomerSheetMounted] = useState(false);
  const [isFrequencySheetMounted, setIsFrequencySheetMounted] = useState(false);
  const [isStartSheetMounted, setIsStartSheetMounted] = useState(false);
  const [isDueOffsetSheetMounted, setIsDueOffsetSheetMounted] = useState(false);
  const [isReminderPresetSheetMounted, setIsReminderPresetSheetMounted] = useState(false);
  const [isCurrencySheetMounted, setIsCurrencySheetMounted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      customerSheetRef.current?.forceClose();
      frequencySheetRef.current?.forceClose();
      startSheetRef.current?.forceClose();
      dueOffsetSheetRef.current?.forceClose();
      reminderPresetSheetRef.current?.forceClose();
      currencySheetRef.current?.forceClose();
    }, [])
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const startLabel = START_OPTIONS.find((o) => o.days === startOffsetDays)?.label ?? 'Today';
  const dueOffsetLabel = DUE_OFFSET_OPTIONS.find((o) => o.days === dueDateOffsetDays)?.label ?? 'No due date';

  function open(ref: RefObject<BottomSheet | null>, mounted: boolean, setMounted: (v: boolean) => void) {
    if (mounted) ref.current?.expand();
    else setMounted(true);
  }

  async function handleCreate() {
    if (isCreating || !userId) return;
    const parsedAmount = Number(amount);
    if (!amount.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Enter an amount', 'Enter a valid amount greater than zero.');
      return;
    }

    setIsCreating(true);
    try {
      const startTarget = new Date();
      startTarget.setDate(startTarget.getDate() + startOffsetDays);
      const { year, month, day } = getZonedDateParts(startTarget, DEVICE_TIMEZONE);

      const plan = await createPlan(userId, {
        customerId,
        amount: parsedAmount,
        currency,
        description: description.trim() || undefined,
        frequency,
        customIntervalDays: frequency === 'custom' ? customIntervalDays : undefined,
        dueDateOffsetDays: dueDateOffsetDays ?? undefined,
        startDate: formatDate(year, month, day),
        maxOccurrences: endMode === 'occurrences' ? maxOccurrences : undefined,
        timezone: DEVICE_TIMEZONE,
        sendHour: 9,
        sendMinute: 0,
        allowPartialPayments,
        depositType: allowPartialPayments ? depositType : undefined,
        depositValue: allowPartialPayments ? depositValue : undefined,
        remindersEnabled: dueDateOffsetDays != null ? remindersEnabled : false,
        reminderPreset,
        sourceTemplateId: params.templateId,
      });
      router.replace(`/recurring?created=${plan.id}`);
    } catch {
      Alert.alert('Something went wrong', "We couldn't create this recurring payment. Check your connection and try again.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Create Recurring Payment" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.lg }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>PAYMENT</Text>
            <TextField
              label={`Amount (${currency})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 500"
            />
            <SelectField
              icon="ellipse"
              label={currency}
              onPress={() => open(currencySheetRef, isCurrencySheetMounted, setIsCurrencySheetMounted)}
            />
            <TextField
              label="Description (Optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="What is this payment for?"
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>CUSTOMER</Text>
            <Pressable
              onPress={() => open(customerSheetRef, isCustomerSheetMounted, setIsCustomerSheetMounted)}
              style={[styles.row, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base }]}
            >
              {selectedCustomer ? (
                <>
                  <CustomerAvatar
                    name={selectedCustomer.name}
                    color={selectedCustomer.avatarColor}
                    avatarUrl={selectedCustomer.avatarUrl}
                    imageType={selectedCustomer.imageType}
                    size={32}
                  />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
                    {selectedCustomer.name}
                  </Text>
                </>
              ) : (
                <Text style={[typography.body, { color: colors.textMuted, flex: 1 }]}>Select a customer (optional)</Text>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>SCHEDULE</Text>
            <SelectField
              icon="repeat-outline"
              label={recurringFrequencyLabel(frequency, customIntervalDays)}
              onPress={() => open(frequencySheetRef, isFrequencySheetMounted, setIsFrequencySheetMounted)}
            />
            {frequency === 'custom' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Pressable
                  onPress={() => setCustomIntervalDays((v) => Math.max(1, v - 1))}
                  style={[styles.stepperButton, { borderColor: colors.border, borderRadius: radius.md }]}
                >
                  <Ionicons name="remove" size={16} color={colors.textPrimary} />
                </Pressable>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, minWidth: 48, textAlign: 'center' }]}>
                  {customIntervalDays} days
                </Text>
                <Pressable
                  onPress={() => setCustomIntervalDays((v) => Math.min(365, v + 1))}
                  style={[styles.stepperButton, { borderColor: colors.border, borderRadius: radius.md }]}
                >
                  <Ionicons name="add" size={16} color={colors.textPrimary} />
                </Pressable>
              </View>
            ) : null}
            <SelectField
              icon="calendar-outline"
              label={`Starts ${startLabel}`}
              onPress={() => open(startSheetRef, isStartSheetMounted, setIsStartSheetMounted)}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(['none', 'occurrences'] as const).map((mode) => {
                const selected = endMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setEndMode(mode)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colors.primaryAction : colors.border,
                        backgroundColor: selected ? colors.softMint : 'transparent',
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text style={[typography.bodySmall, { color: selected ? colors.softMintText : colors.textPrimary }]}>
                      {mode === 'none' ? 'No end date' : 'End after N requests'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {endMode === 'occurrences' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Pressable
                  onPress={() => setMaxOccurrences((v) => Math.max(1, v - 1))}
                  style={[styles.stepperButton, { borderColor: colors.border, borderRadius: radius.md }]}
                >
                  <Ionicons name="remove" size={16} color={colors.textPrimary} />
                </Pressable>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, minWidth: 90, textAlign: 'center' }]}>
                  {maxOccurrences} requests
                </Text>
                <Pressable
                  onPress={() => setMaxOccurrences((v) => Math.min(999, v + 1))}
                  style={[styles.stepperButton, { borderColor: colors.border, borderRadius: radius.md }]}
                >
                  <Ionicons name="add" size={16} color={colors.textPrimary} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>PAYMENT SETTINGS</Text>
            <SelectField
              icon="time-outline"
              label={`Due date: ${dueOffsetLabel}`}
              onPress={() => open(dueOffsetSheetRef, isDueOffsetSheetMounted, setIsDueOffsetSheetMounted)}
            />

            {dueDateOffsetDays != null ? (
              <View style={[styles.settingsCard, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base }]}>
                <View style={styles.settingsRow}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>Payment reminders</Text>
                  <Switch
                    value={remindersEnabled}
                    onValueChange={setRemindersEnabled}
                    trackColor={{ true: colors.primaryAction, false: colors.border }}
                    thumbColor={colors.surface}
                  />
                </View>
                {remindersEnabled ? (
                  <View style={[styles.settingsRow, { marginTop: spacing.sm }]}>
                    <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
                      {reminderPreset[0].toUpperCase() + reminderPreset.slice(1)} schedule
                    </Text>
                    <Pressable onPress={() => open(reminderPresetSheetRef, isReminderPresetSheetMounted, setIsReminderPresetSheetMounted)}>
                      <Text style={[typography.bodySmall, { color: colors.primaryAction }]}>Change</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.settingsCard, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base }]}>
              <View style={styles.settingsRow}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>Allow partial payments</Text>
                <Switch
                  value={allowPartialPayments}
                  onValueChange={(value) => {
                    setAllowPartialPayments(value);
                    if (!value) {
                      setDepositType(undefined);
                      setDepositValue(undefined);
                    }
                  }}
                  trackColor={{ true: colors.primaryAction, false: colors.border }}
                  thumbColor={colors.surface}
                />
              </View>
              {allowPartialPayments ? (
                <View style={{ marginTop: spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {(['none', 'fixed', 'percentage'] as const).map((option) => {
                      const selected = option === 'none' ? !depositType : depositType === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => {
                            if (option === 'none') {
                              setDepositType(undefined);
                              setDepositValue(undefined);
                            } else {
                              setDepositType(option);
                            }
                          }}
                          style={[
                            styles.chip,
                            {
                              borderColor: selected ? colors.primaryAction : colors.border,
                              backgroundColor: selected ? colors.softMint : 'transparent',
                              borderRadius: radius.full,
                            },
                          ]}
                        >
                          <Text style={[typography.bodySmall, { color: selected ? colors.softMintText : colors.textPrimary }]}>
                            {option === 'none' ? 'No deposit' : option === 'fixed' ? 'Fixed amount' : 'Percentage'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {depositType ? (
                    <View style={{ marginTop: spacing.sm }}>
                      <TextField
                        label={depositType === 'fixed' ? `Deposit amount (${currency})` : 'Deposit percentage'}
                        value={depositValue != null ? String(depositValue) : ''}
                        onChangeText={(text) => {
                          const parsed = Number(text);
                          setDepositValue(text.trim().length > 0 && !Number.isNaN(parsed) ? parsed : undefined);
                        }}
                        keyboardType="decimal-pad"
                        placeholder={depositType === 'fixed' ? 'e.g. 100' : 'e.g. 30'}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
          <PrimaryButton label="Create Recurring Payment" onPress={handleCreate} loading={isCreating} />
        </View>
      </KeyboardAvoidingView>

      {isCustomerSheetMounted ? (
        <AppBottomSheet ref={customerSheetRef} initialIndex={0} scrollable>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Select Customer</Text>
          <Pressable
            onPress={() => {
              setCustomerId(undefined);
              customerSheetRef.current?.close();
            }}
            style={[styles.row, { paddingVertical: spacing.sm }]}
          >
            <Text style={[typography.body, { color: colors.textMuted, flex: 1 }]}>No customer</Text>
            {!customerId ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
          </Pressable>
          {customers.map((customer) => (
            <Pressable
              key={customer.id}
              onPress={() => {
                setCustomerId(customer.id);
                customerSheetRef.current?.close();
              }}
              style={[styles.row, { paddingVertical: spacing.sm }]}
            >
              <CustomerAvatar name={customer.name} color={customer.avatarColor} avatarUrl={customer.avatarUrl} imageType={customer.imageType} size={32} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
                {customer.name}
              </Text>
              {customerId === customer.id ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          ))}
        </AppBottomSheet>
      ) : null}

      {isFrequencySheetMounted ? (
        <AppBottomSheet ref={frequencySheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Frequency</Text>
          {FREQUENCY_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                setFrequency(option);
                frequencySheetRef.current?.close();
              }}
              style={[styles.row, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{recurringFrequencyLabel(option)}</Text>
              {frequency === option ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          ))}
        </AppBottomSheet>
      ) : null}

      {isStartSheetMounted ? (
        <AppBottomSheet ref={startSheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Starts</Text>
          {START_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              onPress={() => {
                setStartOffsetDays(option.days);
                startSheetRef.current?.close();
              }}
              style={[styles.row, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
              {startOffsetDays === option.days ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          ))}
        </AppBottomSheet>
      ) : null}

      {isDueOffsetSheetMounted ? (
        <AppBottomSheet ref={dueOffsetSheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Due Date</Text>
          {DUE_OFFSET_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              onPress={() => {
                setDueDateOffsetDays(option.days);
                if (option.days == null) setRemindersEnabled(false);
                dueOffsetSheetRef.current?.close();
              }}
              style={[styles.row, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
              {dueDateOffsetDays === option.days ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
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

      {isCurrencySheetMounted ? (
        <CurrencySelectSheet
          ref={currencySheetRef}
          initialIndex={0}
          value={currency}
          onSelect={(asset) => {
            setCurrency(asset);
            currencySheetRef.current?.close();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  stepperButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  settingsCard: { borderWidth: 1 },
  settingsRow: { flexDirection: 'row', alignItems: 'center' },
});
