import { useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { RequestCard } from '../../../src/components/RequestCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestStore } from '../../../src/store/requestStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { getCustomerStats } from '../../../src/utils/getCustomerStats';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { isValidEmail } from '../../../src/utils/validators';
import type { PaymentRequest } from '../../../src/types';

function getDateLabel(request: PaymentRequest): string {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (request.status === 'paid') return `Paid on ${formatDate(request.createdAt)}`;
  if (request.status === 'cancelled') return 'Cancelled';
  if (request.status === 'expired') return `Expired on ${request.expiresAt ? formatDate(request.expiresAt) : formatDate(request.createdAt)}`;
  return `Requested ${formatDate(request.createdAt)}`;
}

export default function CustomerDetailScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === id));
  const requests = useRequestStore((state) => state.requests);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);
  const updateCustomer = useCustomerStore((state) => state.updateCustomer);

  const history = useMemo(
    () =>
      requests
        .filter((r) => r.customerId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [requests, id]
  );

  const editSheetRef = useRef<BottomSheet>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | undefined>();

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
    prefillDraft({ customerId });
    router.push('/request/amount');
  }

  function openEditSheet() {
    if (!customer) return;
    setEditName(customer.name);
    setEditEmail(customer.email);
    setEditCompany(customer.company ?? '');
    setEditNotes(customer.notes ?? '');
    setEditError(undefined);
    editSheetRef.current?.expand();
  }

  function handleSaveEdit() {
    if (editName.trim().length === 0 || !isValidEmail(editEmail)) {
      setEditError('Enter a name and valid email');
      return;
    }
    updateCustomer(customerId, {
      name: editName.trim(),
      email: editEmail.trim(),
      company: editCompany.trim() || undefined,
      notes: editNotes.trim() || undefined,
    });
    editSheetRef.current?.close();
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

            <View style={[styles.statsRow, { marginTop: spacing.xl, gap: spacing.md }]}>
              <ThemeAwareCard style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Total Received</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  {formatCurrency(stats.totalReceived)}
                </Text>
              </ThemeAwareCard>
              <ThemeAwareCard style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Payments</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  {stats.totalRequests}
                </Text>
              </ThemeAwareCard>
              <ThemeAwareCard style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Outstanding</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  {formatCurrency(stats.outstanding)}
                </Text>
              </ThemeAwareCard>
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
        renderItem={({ item }) => (
          <RequestCard
            title={item.description || item.paymentCode}
            amount={item.amount}
            currency={item.currency}
            status={item.status}
            dateLabel={getDateLabel(item)}
            onPress={() => router.push(`/(app)/requests/${item.id}`)}
          />
        )}
      />
      <AppBottomSheet ref={editSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Edit Customer</Text>
        <TextField label="Name" value={editName} onChangeText={setEditName} error={editError} />
        <TextField label="Email" value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Company (Optional)" value={editCompany} onChangeText={setEditCompany} />
        <TextField label="Notes (Optional)" value={editNotes} onChangeText={setEditNotes} multiline />
        <PrimaryButton label="Save Changes" onPress={handleSaveEdit} />
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row' },
});
