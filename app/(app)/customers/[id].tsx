import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { StatTile } from '../../../src/components/StatTile';
import { RequestCard } from '../../../src/components/RequestCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestStore } from '../../../src/store/requestStore';
import { useTransactionStore } from '../../../src/store/transactionStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../../../src/store/paymentDefaultsStore';
import { useAuthStore } from '../../../src/store/authStore';
import { getCustomerStats } from '../../../src/utils/getCustomerStats';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { getDateLabel } from '../../../src/utils/getDateLabel';
import { isValidEmail } from '../../../src/utils/validators';
import type { PaymentRequest } from '../../../src/types';

const NARROW_SCREEN_WIDTH = 360;

export default function CustomerDetailScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < NARROW_SCREEN_WIDTH;
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === id));
  const requests = useRequestStore((state) => state.requests);
  const transactions = useTransactionStore((state) => state.transactions);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);
  const updateCustomer = useCustomerStore((state) => state.updateCustomer);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  const userId = useAuthStore((state) => state.user?.id);

  const history = useMemo(
    () =>
      requests
        .filter((r) => r.customerId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [requests, id]
  );

  const transactionByRequestId = useMemo(() => {
    const map = new Map<string, (typeof transactions)[number]>();
    for (const transaction of transactions) map.set(transaction.requestId, transaction);
    return map;
  }, [transactions]);

  const handleHistoryRowPress = useCallback((requestId: string) => {
    router.push(`/(app)/requests/${requestId}`);
  }, []);

  const renderHistoryRow = useCallback(
    ({ item }: { item: PaymentRequest }) => (
      <RequestCard
        title={item.description || item.paymentCode}
        amount={item.amount}
        currency={item.currency}
        status={item.status}
        dateLabel={getDateLabel(item, transactionByRequestId.get(item.id))}
        onPress={() => handleHistoryRowPress(item.id)}
      />
    ),
    [transactionByRequestId, handleHistoryRowPress]
  );

  const editSheetRef = useRef<BottomSheet>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editNameError, setEditNameError] = useState<string | undefined>();
  const [editEmailError, setEditEmailError] = useState<string | undefined>();
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  if (!customer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Customer" onBackPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const stats = getCustomerStats(customer.id, requests);
  const customerId = customer.id;

  function handleRequestPayment() {
    prefillDraft({ customerId, expiryOption: defaultExpiryOption });
    router.push('/request/amount');
  }

  function openEditSheet() {
    if (!customer) return;
    setEditName(customer.name);
    setEditEmail(customer.email);
    setEditCompany(customer.company ?? '');
    setEditNotes(customer.notes ?? '');
    setEditNameError(undefined);
    setEditEmailError(undefined);
    editSheetRef.current?.expand();
  }

  async function handleSaveEdit() {
    if (isSavingEdit) return;
    const nameError = editName.trim().length === 0 ? 'Enter a name' : undefined;
    const emailError = !isValidEmail(editEmail) ? 'Enter a valid email' : undefined;
    setEditNameError(nameError);
    setEditEmailError(emailError);
    if (nameError || emailError || !userId) return;

    setIsSavingEdit(true);
    try {
      await updateCustomer(userId, customerId, {
        name: editName.trim(),
        email: editEmail.trim(),
        company: editCompany.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      editSheetRef.current?.close();
    } catch {
      // updateCustomer already set a calm store-level error; keep the sheet
      // open with the entered values intact so the user can retry.
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Customer" onBackPress={() => router.back()} rightIcon="create-outline" onRightPress={openEditSheet} />
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.xl }}>
            <View style={styles.headerRow}>
              <CustomerAvatar name={customer.name} color={customer.avatarColor} size={56} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>{customer.name}</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{customer.email}</Text>
                {customer.company ? (
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{customer.company}</Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.statsRow, { marginTop: spacing.lg, gap: spacing.sm }]}>
              <StatTile
                label="Total Received"
                value={formatCurrency(stats.totalReceived)}
                style={isNarrow ? { width: '48%' } : { flex: 1 }}
              />
              <StatTile
                label="Payments"
                value={String(stats.totalRequests)}
                style={isNarrow ? { width: '48%' } : { flex: 1 }}
              />
              <StatTile
                label="Outstanding"
                value={formatCurrency(stats.outstanding)}
                style={isNarrow ? { width: '100%' } : { flex: 1 }}
              />
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <PrimaryButton label="Request Payment" onPress={handleRequestPayment} />
            </View>

            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
              HISTORY
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="document-text-outline" title="No requests yet" description="Requests sent to this customer will show up here." />
        }
        renderItem={renderHistoryRow}
      />
      <AppBottomSheet ref={editSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Edit Customer</Text>
        <TextField label="Name" value={editName} onChangeText={setEditName} error={editNameError} />
        <TextField
          label="Email"
          value={editEmail}
          onChangeText={setEditEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={editEmailError}
        />
        <TextField label="Company (Optional)" value={editCompany} onChangeText={setEditCompany} />
        <TextField label="Notes (Optional)" value={editNotes} onChangeText={setEditNotes} multiline />
        <PrimaryButton label="Save Changes" onPress={handleSaveEdit} loading={isSavingEdit} />
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap' },
});
