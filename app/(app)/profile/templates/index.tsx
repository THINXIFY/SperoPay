import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, Switch, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../../src/theme/useTheme';
import { AppHeader } from '../../../../src/components/AppHeader';
import { TAB_BAR_CONTENT_HEIGHT } from '../../../../src/components/BottomNavigation';
import { AppBottomSheet } from '../../../../src/components/AppBottomSheet';
import { AppActionSheet, type ActionSheetItem } from '../../../../src/components/AppActionSheet';
import { ReminderPresetSheet } from '../../../../src/components/ReminderPresetSheet';
import { TextField } from '../../../../src/components/TextField';
import { SelectField } from '../../../../src/components/SelectField';
import { PrimaryButton } from '../../../../src/components/PrimaryButton';
import { EmptyState } from '../../../../src/components/EmptyState';
import { SkeletonLoader } from '../../../../src/components/SkeletonLoader';
import { AppRefreshControl } from '../../../../src/components/AppRefreshControl';
import { ConfirmationModal } from '../../../../src/components/ConfirmationModal';
import { CustomerAvatar } from '../../../../src/components/CustomerAvatar';
import { PaymentTemplateCard } from '../../../../src/components/PaymentTemplateCard';
import { CurrencySelectSheet } from '../../../../src/components/CurrencySelectSheet';
import { useTemplateStore } from '../../../../src/store/templateStore';
import { useCustomerStore } from '../../../../src/store/customerStore';
import { useRequestDraftStore } from '../../../../src/store/requestDraftStore';
import { useAuthStore } from '../../../../src/store/authStore';
import { usePaymentDefaultsStore } from '../../../../src/store/paymentDefaultsStore';
import { useRefreshTemplateData } from '../../../../src/store/useRefreshTemplateData';
import { isValidAmount } from '../../../../src/utils/validators';
import { reminderScheduleSummary, rulesForPreset } from '../../../../src/utils/reminderSchedule';
import { DEFAULT_ASSET, type AssetSymbol } from '../../../../src/config/assets';
import type { ExpiryOption, ReminderPreset, Template } from '../../../../src/types';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
];

// The form sheet's content (title + name/amount/description fields + an
// expiry row + a customer row + a reminders toggle + the submit button)
// runs taller than AppBottomSheet's default 40% first snap point -- on
// first open that left the submit button below the fold with no obvious
// affordance to scroll to it, which is what actually made "+" look broken
// (it opened something, just not visibly a usable form). A single tall
// snap point guarantees the whole form is visible without a hidden scroll.
const FORM_SHEET_SNAP_POINTS = ['90%'];
const EXPIRY_SHEET_SNAP_POINTS = ['40%'];
const CUSTOMER_SHEET_SNAP_POINTS = ['70%'];

// Favorites first, then most-recently-used, then everything else in its
// existing (created_at desc) order -- Array.prototype.sort is stable, so a
// 0 return for a tie never reshuffles the remaining templates.
function sortTemplates(templates: Template[]): Template[] {
  return [...templates].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    return bTime - aTime;
  });
}

export default function PaymentTemplatesScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const templates = useTemplateStore((state) => state.templates);
  const addTemplate = useTemplateStore((state) => state.addTemplate);
  const updateTemplate = useTemplateStore((state) => state.updateTemplate);
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);
  const duplicateTemplate = useTemplateStore((state) => state.duplicateTemplate);
  const toggleFavorite = useTemplateStore((state) => state.toggleFavorite);
  const setArchived = useTemplateStore((state) => state.setArchived);
  const status = useTemplateStore((state) => state.status);
  const listError = useTemplateStore((state) => state.error);
  const customers = useCustomerStore((state) => state.customers);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);
  const userId = useAuthStore((state) => state.user?.id);
  const defaultCurrency = usePaymentDefaultsStore((state) => state.defaultCurrency);
  const { refresh, isRefreshing } = useRefreshTemplateData();

  const formSheetRef = useRef<BottomSheet>(null);
  const expirySheetRef = useRef<BottomSheet>(null);
  const customerSheetRef = useRef<BottomSheet>(null);
  const actionsSheetRef = useRef<BottomSheet>(null);
  const [actionsTarget, setActionsTarget] = useState<Template | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<AssetSymbol>(DEFAULT_ASSET);
  const [description, setDescription] = useState('');
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>('7d');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>('standard');
  const [customerSearch, setCustomerSearch] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const favoriteInFlightRef = useRef<Set<string>>(new Set());

  // Neither sheet is rendered at all until first opened -- see
  // request/amount.tsx for why this is the correct fix: gorhom's imperative
  // .expand() silently no-ops if called before native layout resolves,
  // which an always-mounted sheet's first .expand() call can race.
  const [isFormSheetMounted, setIsFormSheetMounted] = useState(false);
  const [isExpirySheetMounted, setIsExpirySheetMounted] = useState(false);
  const [isCustomerSheetMounted, setIsCustomerSheetMounted] = useState(false);
  const [isActionsSheetMounted, setIsActionsSheetMounted] = useState(false);
  const reminderPresetSheetRef = useRef<BottomSheet>(null);
  const [isReminderPresetSheetMounted, setIsReminderPresetSheetMounted] = useState(false);
  const currencySheetRef = useRef<BottomSheet>(null);
  const [isCurrencySheetMounted, setIsCurrencySheetMounted] = useState(false);

  function openFormSheet() {
    if (isFormSheetMounted) formSheetRef.current?.expand();
    else setIsFormSheetMounted(true);
  }
  function openExpirySheet() {
    if (isExpirySheetMounted) expirySheetRef.current?.expand();
    else setIsExpirySheetMounted(true);
  }
  function openCurrencySheet() {
    if (isCurrencySheetMounted) currencySheetRef.current?.expand();
    else setIsCurrencySheetMounted(true);
  }
  function openCustomerSheet() {
    setCustomerSearch('');
    if (isCustomerSheetMounted) customerSheetRef.current?.expand();
    else setIsCustomerSheetMounted(true);
  }
  function openReminderPresetSheet() {
    if (isReminderPresetSheetMounted) reminderPresetSheetRef.current?.expand();
    else setIsReminderPresetSheetMounted(true);
  }

  // Defense in depth for a reused/backgrounded screen instance whose sheet
  // was left open from an earlier visit.
  useFocusEffect(
    useCallback(() => {
      formSheetRef.current?.forceClose();
      expirySheetRef.current?.forceClose();
      customerSheetRef.current?.forceClose();
      actionsSheetRef.current?.forceClose();
      reminderPresetSheetRef.current?.forceClose();
      currencySheetRef.current?.forceClose();
    }, [])
  );

  function openCreateForm() {
    if (busyId) return;
    setEditingId(null);
    setName('');
    setAmount('');
    setCurrency(defaultCurrency);
    setDescription('');
    setExpiryOption('7d');
    setCustomerId(undefined);
    setRemindersEnabled(true);
    setReminderPreset('standard');
    setError(undefined);
    openFormSheet();
  }

  function openEditForm(template: Template) {
    setEditingId(template.id);
    setName(template.name);
    setAmount(template.amount != null ? String(template.amount) : '');
    setCurrency(template.currency);
    setDescription(template.description ?? '');
    setExpiryOption(template.expiryOption);
    setCustomerId(template.customerId);
    setRemindersEnabled(template.remindersEnabled);
    setReminderPreset(template.reminderPreset);
    setError(undefined);
    openFormSheet();
  }

  async function handleSave() {
    if (isSaving) return;
    const trimmedAmount = amount.trim();
    const numericAmount = trimmedAmount.length > 0 ? Number(trimmedAmount) : undefined;
    if (name.trim().length === 0) {
      setError('Enter a template name');
      return;
    }
    if (numericAmount !== undefined && !isValidAmount(numericAmount)) {
      setError('Enter a valid amount, or leave it blank for a flexible amount');
      return;
    }
    if (!userId) return;
    const input = {
      name: name.trim(),
      amount: numericAmount,
      currency,
      description: description.trim() || undefined,
      expiryOption,
      customerId,
      remindersEnabled,
      reminderPreset,
    };
    setIsSaving(true);
    try {
      if (editingId) {
        await updateTemplate(userId, editingId, input);
      } else {
        await addTemplate(userId, input);
      }
      formSheetRef.current?.close();
    } catch {
      setError("We couldn't save this template. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!userId || !deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteTemplate(userId, deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      Alert.alert("Couldn't Delete", "We couldn't delete this template. Check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleUseTemplate(template: Template) {
    if (busyId) return;
    prefillDraft({
      amount: template.amount != null ? String(template.amount) : undefined,
      currency: template.currency,
      description: template.description,
      customerId: template.customerId,
      expiryOption: template.expiryOption,
      sourceTemplateId: template.id,
      remindersEnabled: template.remindersEnabled,
      reminderPreset: template.reminderPreset,
      reminderCustomRules: template.reminderCustomRules,
    });
    router.push('/request/amount');
  }

  function handleMakeRecurring(template: Template) {
    // Only a snapshot origin is passed (see recurring_payment_plans'
    // source_template_id) -- the create screen reads these once to seed its
    // own local state, then never looks back at the template again.
    router.push({
      pathname: '/recurring/create',
      params: {
        templateId: template.id,
        amount: template.amount != null ? String(template.amount) : undefined,
        currency: template.currency,
        description: template.description ?? undefined,
        reminderPreset: template.reminderPreset,
      },
    });
  }

  async function handleToggleFavorite(template: Template) {
    // Guards against a rapid double-tap firing two concurrent writes with
    // opposite is_favorite values -- the second could land after the
    // first and leave the server out of sync with what's shown until the
    // next reload. This intentionally doesn't route through `busyId`
    // (which visually dims the whole card for Duplicate/Archive): a
    // dropped second tap while the first is still in flight is enough,
    // and favoriting should otherwise still feel instant.
    if (!userId || favoriteInFlightRef.current.has(template.id)) return;
    favoriteInFlightRef.current.add(template.id);
    try {
      await toggleFavorite(userId, template.id);
    } catch {
      // toggleFavorite already rolled back the optimistic flip and set a
      // calm store error -- nothing further to do here.
    } finally {
      favoriteInFlightRef.current.delete(template.id);
    }
  }

  async function handleDuplicate(template: Template) {
    if (!userId || busyId) return;
    setBusyId(template.id);
    try {
      await duplicateTemplate(userId, template.id);
    } catch {
      Alert.alert("Couldn't Duplicate", "We couldn't duplicate this template. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleArchive(template: Template) {
    if (!userId || busyId) return;
    setBusyId(template.id);
    try {
      await setArchived(userId, template.id, !template.isArchived);
    } catch {
      Alert.alert("Couldn't Update", "We couldn't update this template. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  function openTemplateActions(template: Template) {
    // Don't offer Edit/Duplicate/Archive/Delete on a template that already
    // has one of those mutations in flight -- avoids e.g. opening an Edit
    // sheet on a template mid-archive.
    if (busyId === template.id) return;
    setActionsTarget(template);
    if (isActionsSheetMounted) actionsSheetRef.current?.expand();
    else setIsActionsSheetMounted(true);
  }

  function runTemplateAction(action: () => void) {
    actionsSheetRef.current?.close();
    action();
  }

  const templateActions: ActionSheetItem[] = actionsTarget
    ? [
        { key: 'edit', label: 'Edit', icon: 'create-outline', onPress: () => runTemplateAction(() => openEditForm(actionsTarget)) },
        {
          key: 'duplicate',
          label: 'Duplicate',
          icon: 'copy-outline',
          onPress: () => runTemplateAction(() => handleDuplicate(actionsTarget)),
        },
        {
          key: 'make-recurring',
          label: 'Make recurring',
          icon: 'repeat-outline',
          onPress: () => runTemplateAction(() => handleMakeRecurring(actionsTarget)),
        },
        {
          key: 'archive',
          label: 'Archive',
          icon: 'archive-outline',
          onPress: () => runTemplateAction(() => handleToggleArchive(actionsTarget)),
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: 'trash-outline',
          destructive: true,
          onPress: () => runTemplateAction(() => setDeleteTarget(actionsTarget)),
        },
      ]
    : [];

  const activeTemplates = useMemo(() => sortTemplates(templates.filter((t) => !t.isArchived)), [templates]);
  const archivedCount = useMemo(() => templates.filter((t) => t.isArchived).length, [templates]);
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const expiryLabel = EXPIRY_OPTIONS.find((opt) => opt.value === expiryOption)?.label ?? '7 days';
  const filteredCustomers = useMemo(() => {
    const trimmed = customerSearch.trim().toLowerCase();
    if (trimmed.length === 0) return customers;
    return customers.filter((c) => [c.name, c.email, c.company].some((value) => value?.toLowerCase().includes(trimmed)));
  }, [customers, customerSearch]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader
        title="Payment Templates"
        onBackPress={() => router.back()}
        rightIcon="add"
        onRightPress={openCreateForm}
        rightAccessibilityLabel="Create payment template"
      />
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
        <View style={styles.subtitleRow}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
            Save common payment details and reuse them anytime.
          </Text>
          {archivedCount > 0 ? (
            <Pressable onPress={() => router.push('/(app)/profile/templates/archived')} hitSlop={8}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Archived ({archivedCount})</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlatList
        data={activeTemplates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: TAB_BAR_CONTENT_HEIGHT + spacing.xl,
          gap: spacing.md,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          status === 'loading' ? (
            <View style={{ gap: spacing.md }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.lg,
                    padding: spacing.base,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <SkeletonLoader width={32} height={32} style={{ borderRadius: radius.full }} />
                    <View style={{ marginLeft: spacing.sm, flex: 1, gap: spacing.xs }}>
                      <SkeletonLoader width="55%" height={14} />
                      <SkeletonLoader width="35%" height={11} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : status === 'error' ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Couldn't load templates"
              description={listError ?? 'Something went wrong. Try again.'}
            />
          ) : (
            <EmptyState
              icon="copy-outline"
              title="Save time on repeat payments"
              description="Create a payment template for details you use often."
              actionLabel="Create Payment Template"
              onActionPress={openCreateForm}
            />
          )
        }
        renderItem={({ item }) => (
          <PaymentTemplateCard
            template={item}
            customer={customers.find((c) => c.id === item.customerId)}
            disabled={busyId === item.id}
            onPress={() => handleUseTemplate(item)}
            onToggleFavorite={() => handleToggleFavorite(item)}
            onOpenActions={() => openTemplateActions(item)}
          />
        )}
      />

      {isFormSheetMounted ? (
        <AppBottomSheet ref={formSheetRef} initialIndex={0} snapPoints={FORM_SHEET_SNAP_POINTS} scrollable>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
            {editingId ? 'Edit Payment Template' : 'New Payment Template'}
          </Text>
          <TextField label="Template Name" value={name} onChangeText={setName} error={error} placeholder="Template name" />
          <TextField
            label={`Amount (${currency}) — Optional`}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="Leave blank for a flexible amount"
          />
          <View style={{ marginBottom: spacing.base }}>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Currency</Text>
            <SelectField icon="ellipse" label={currency} onPress={openCurrencySheet} />
          </View>
          <TextField
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What is this payment for?"
          />
          <View style={{ marginBottom: spacing.base }}>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Expires In</Text>
            <SelectField icon="time-outline" label={expiryLabel} onPress={openExpirySheet} />
          </View>
          <View style={{ marginBottom: spacing.base }}>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Default Customer — Optional
            </Text>
            <SelectField
              icon="person-outline"
              label={selectedCustomer ? selectedCustomer.name : 'Choose when using the template'}
              isPlaceholder={!selectedCustomer}
              onPress={openCustomerSheet}
            />
          </View>
          <View
            style={[
              styles.reminderRow,
              { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base, marginBottom: spacing.base },
            ]}
          >
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={[typography.body, { color: colors.textPrimary }]}>Payment reminders</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                Suggest sending a reminder for requests created from this template.
              </Text>
            </View>
            <Switch
              value={remindersEnabled}
              onValueChange={setRemindersEnabled}
              trackColor={{ true: colors.primaryAction, false: colors.border }}
              thumbColor={colors.surface}
              accessibilityLabel="Payment reminders"
            />
          </View>
          {remindersEnabled ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                Reminder Schedule
              </Text>
              <SelectField
                icon="alarm-outline"
                label={reminderPreset === 'custom' ? 'Custom' : `${reminderPreset[0].toUpperCase()}${reminderPreset.slice(1)}`}
                onPress={openReminderPresetSheet}
              />
              {reminderPreset !== 'custom' ? (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                  {reminderScheduleSummary(rulesForPreset(reminderPreset, undefined))}
                </Text>
              ) : (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                  Choose exact reminder timing when creating a request from this template.
                </Text>
              )}
            </View>
          ) : null}
          <PrimaryButton
            label={editingId ? 'Save Changes' : 'Save Template'}
            onPress={handleSave}
            loading={isSaving}
          />
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

      {isExpirySheetMounted ? (
        <AppBottomSheet ref={expirySheetRef} initialIndex={0} snapPoints={EXPIRY_SHEET_SNAP_POINTS}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Expires In</Text>
          {EXPIRY_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                setExpiryOption(option.value);
                expirySheetRef.current?.close();
              }}
              style={[styles.optionRow, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
              {expiryOption === option.value ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          ))}
        </AppBottomSheet>
      ) : null}

      {isCustomerSheetMounted ? (
        <AppBottomSheet ref={customerSheetRef} initialIndex={0} snapPoints={CUSTOMER_SHEET_SNAP_POINTS} scrollable>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Default Customer</Text>
          {customers.length > 5 ? (
            <View
              style={[
                styles.searchRow,
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
          <Pressable
            onPress={() => {
              setCustomerId(undefined);
              customerSheetRef.current?.close();
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: !customerId }}
            style={({ pressed }) => [
              styles.optionRow,
              {
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: !customerId ? colors.softMint : pressed ? colors.background : 'transparent',
              },
            ]}
          >
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>No default — choose when using it</Text>
            {!customerId ? <Ionicons name="checkmark-circle" size={20} color={colors.softMintText} /> : null}
          </Pressable>
          {customers.length === 0 ? null : filteredCustomers.length === 0 ? (
            <Text style={[typography.bodySmall, { color: colors.textMuted, paddingVertical: spacing.md }]}>
              {`No customers match "${customerSearch}".`}
            </Text>
          ) : (
            filteredCustomers.map((customer) => {
              const isSelected = customer.id === customerId;
              return (
                <Pressable
                  key={customer.id}
                  onPress={() => {
                    setCustomerId(customer.id);
                    customerSheetRef.current?.close();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [
                    styles.optionRow,
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
                    size={32}
                  />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                      {customer.name}
                    </Text>
                  </View>
                  {isSelected ? <Ionicons name="checkmark-circle" size={20} color={colors.softMintText} /> : null}
                </Pressable>
              );
            })
          )}
        </AppBottomSheet>
      ) : null}

      {isActionsSheetMounted ? (
        <AppActionSheet ref={actionsSheetRef} initialIndex={0} title={actionsTarget?.name} actions={templateActions} />
      ) : null}

      <ConfirmationModal
        visible={deleteTarget !== null}
        title="Delete this payment template?"
        description={deleteTarget ? `"${deleteTarget.name}" will be permanently removed. This can't be undone.` : ''}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={isDeleting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  subtitleRow: { flexDirection: 'row', alignItems: 'center' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1 },
});
