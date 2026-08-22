import { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const expiryLabel = EXPIRY_OPTIONS.find((opt) => opt.value === expiryOption)?.label ?? '7 days';

  function handleSelectCustomer(id: string) {
    setCustomerId(id);
    customerSheetRef.current?.close();
  }

  async function handleAddCustomer() {
    const nextNameError = newCustomerName.trim().length === 0 ? 'Enter a name' : undefined;
    const nextEmailError = !isValidEmail(newCustomerEmail) ? 'Enter a valid email' : undefined;
    setNewCustomerNameError(nextNameError);
    setNewCustomerEmailError(nextEmailError);
    if (nextNameError || nextEmailError || !userId) return;

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
            placeholder="Website design service — May 2026"
          />

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>Customer</Text>
            <Pressable
              onPress={() => customerSheetRef.current?.expand()}
              style={[
                styles.customerRow,
                { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base },
              ]}
            >
              {selectedCustomer ? (
                <>
                  <CustomerAvatar name={selectedCustomer.name} color={selectedCustomer.avatarColor} size={36} />
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
              onPress={() => expirySheetRef.current?.expand()}
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
            placeholder="Thank you for your business!"
            multiline
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Create Request" onPress={handleCreateRequest} loading={isCreating} />
      </View>

      {isCreating ? (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.background }]}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Creating your request...</Text>
        </View>
      ) : null}

      <AppBottomSheet ref={customerSheetRef} scrollable>
        {isAddingCustomer ? (
          <>
            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Add New Customer</Text>
            <TextField label="Name" value={newCustomerName} onChangeText={setNewCustomerName} error={newCustomerNameError} />
            <TextField
              label="Email"
              value={newCustomerEmail}
              onChangeText={setNewCustomerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={newCustomerEmailError}
            />
            <PrimaryButton label="Add Customer" onPress={handleAddCustomer} />
          </>
        ) : (
          <>
            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Customer</Text>
            {customers.map((customer) => (
              <Pressable
                key={customer.id}
                onPress={() => handleSelectCustomer(customer.id)}
                style={[styles.customerRow, { paddingVertical: spacing.sm }]}
              >
                <CustomerAvatar name={customer.name} color={customer.avatarColor} size={36} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{customer.name}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{customer.email}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setIsAddingCustomer(true)}
              style={[styles.customerRow, { paddingVertical: spacing.md, marginTop: spacing.xs }]}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.textPrimary} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                Add new customer
              </Text>
            </Pressable>
          </>
        )}
      </AppBottomSheet>

      <AppBottomSheet ref={expirySheetRef}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  readonlyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1 },
  customerRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  overlay: { alignItems: 'center', justifyContent: 'center' },
});
