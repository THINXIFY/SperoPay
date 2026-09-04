import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { CustomerAvatar } from '../../src/components/CustomerAvatar';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useTemplateStore } from '../../src/store/templateStore';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail } from '../../src/utils/validators';
import type { ExpiryOption } from '../../src/types';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
];

export default function DetailsScreen() {
  const { colors, spacing, radius, typography } = useTheme();

  const amount = useRequestDraftStore((state) => state.amount);
  const description = useRequestDraftStore((state) => state.description);
  const setDescription = useRequestDraftStore((state) => state.setDescription);
  const customerId = useRequestDraftStore((state) => state.customerId);
  const setCustomerId = useRequestDraftStore((state) => state.setCustomerId);
  const expiryOption = useRequestDraftStore((state) => state.expiryOption);
  const setExpiryOption = useRequestDraftStore((state) => state.setExpiryOption);
  const note = useRequestDraftStore((state) => state.note);
  const setNote = useRequestDraftStore((state) => state.setNote);
  const setLastCreatedRequestId = useRequestDraftStore((state) => state.setLastCreatedRequestId);
  const sourceTemplateId = useRequestDraftStore((state) => state.sourceTemplateId);

  const customers = useCustomerStore((state) => state.customers);
  const addCustomer = useCustomerStore((state) => state.addCustomer);
  const createRequest = useRequestStore((state) => state.createRequest);
  const isCreating = useRequestStore((state) => state.isCreating);
  const userId = useAuthStore((state) => state.user?.id);

  const customerSheetRef = useRef<BottomSheet>(null);
  const expirySheetRef = useRef<BottomSheet>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerNameError, setNewCustomerNameError] = useState<string | undefined>();
  const [newCustomerEmailError, setNewCustomerEmailError] = useState<string | undefined>();
  const [isSavingNewCustomer, setIsSavingNewCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Neither sheet is rendered at all until first opened -- see
  // request/amount.tsx for why this is the correct fix: gorhom's imperative
  // .expand() silently no-ops if called before native layout resolves,
  // which an always-mounted sheet's first .expand() call can race.
  // AppBottomSheet's `initialIndex` prop is the layout-aware, declarative
  // alternative used on first mount below.
  const [isCustomerSheetMounted, setIsCustomerSheetMounted] = useState(false);
  const [isExpirySheetMounted, setIsExpirySheetMounted] = useState(false);

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

  // Defense in depth for a reused/backgrounded screen instance whose sheet
  // was left open from an earlier visit.
  useFocusEffect(
    useCallback(() => {
      customerSheetRef.current?.forceClose();
      expirySheetRef.current?.forceClose();
    }, [])
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const expiryLabel = EXPIRY_OPTIONS.find((opt) => opt.value === expiryOption)?.label ?? '7 days';

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
    try {
      const request = await createRequest(userId, {
        amount: Number(amount),
        description: description.trim() || undefined,
        customerId,
        expiryOption,
        note: note.trim() || undefined,
      });
      setLastCreatedRequestId(request.id);
      if (sourceTemplateId) {
        // Fire-and-forget: only counts a "use" once a request is actually
        // created (never on a bare "Use Template" tap), but a failure here
        // must never block or affect navigation to the just-created request.
        useTemplateStore.getState().recordUsage(userId, sourceTemplateId);
      }
      router.replace(`/request/created?id=${request.id}`);
    } catch {
      Alert.alert('Something went wrong', "We couldn't create this request. Check your connection and try again.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Request Details" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Amount</Text>
            <View
              style={[
                styles.readonlyRow,
                { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base, marginTop: spacing.xs },
              ]}
            >
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{Number(amount).toFixed(2)}</Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>USDC</Text>
            </View>
          </View>

          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>On</Text>
            <View
              style={[
                styles.readonlyRow,
                { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base, marginTop: spacing.xs },
              ]}
            >
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Solana</Text>
            </View>
          </View>

          <TextField
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What is this payment for?"
            returnKeyType="done"
          />

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>Customer</Text>
            <Pressable
              onPress={openCustomerSheet}
              style={[
                styles.customerRow,
                { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base },
              ]}
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
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{selectedCustomer.name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{selectedCustomer.email}</Text>
                  </View>
                </>
              ) : (
                <Text style={[typography.body, { color: colors.textMuted, flex: 1 }]}>Select a customer (optional)</Text>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>Expires In</Text>
            <Pressable
              onPress={openExpirySheet}
              style={[
                styles.customerRow,
                { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base },
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
                {expiryLabel}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <TextField
            label="Note to Customer (Optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Add an optional note"
            multiline
          />
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  readonlyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1 },
  customerRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  overlay: { alignItems: 'center', justifyContent: 'center' },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  sheetSearchRow: { flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1 },
  sheetDivider: { height: 1 },
  addIconCircle: { alignItems: 'center', justifyContent: 'center' },
});
