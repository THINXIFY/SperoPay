import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { CustomerImagePicker } from '../../../src/components/CustomerImagePicker';
import { StatTile } from '../../../src/components/StatTile';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
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
import { useCustomerImageEditor } from '../../../src/hooks/useCustomerImageEditor';
import { uploadCustomerAvatar, deleteAvatarByUrl } from '../../../src/services/storage/avatarUpload';
import { avatarDebugLog } from '../../../src/utils/avatarDebugLog';
import { getCustomerStats } from '../../../src/utils/getCustomerStats';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { getDateLabel } from '../../../src/utils/getDateLabel';
import { isValidEmail } from '../../../src/utils/validators';
import type { PaymentRequest } from '../../../src/types';

export default function CustomerDetailScreen() {
  const { colors, spacing, radius, typography } = useTheme();
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

  const stats = useMemo(() => getCustomerStats(id ?? '', requests), [id, requests]);

  const handleHistoryRowPress = useCallback((requestId: string) => {
    router.push(`/(app)/requests/${requestId}`);
  }, []);

  const renderHistoryRow = useCallback(
    ({ item }: { item: PaymentRequest }) => (
      <RequestCard
        id={item.id}
        title={item.description || item.paymentCode}
        amount={item.amount}
        currency={item.currency}
        status={item.status}
        dateLabel={getDateLabel(item, transactionByRequestId.get(item.id))}
        onPress={handleHistoryRowPress}
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
  const editImage = useCustomerImageEditor({ avatarUrl: customer?.avatarUrl, imageType: customer?.imageType });

  // Not rendered at all until first opened -- see request/amount.tsx for
  // why this is the correct fix: gorhom's imperative .expand() silently
  // no-ops if called before native layout resolves, which an always-mounted
  // sheet's first .expand() call can race. AppBottomSheet's `initialIndex`
  // prop is the layout-aware, declarative alternative used on first mount.
  const [isEditSheetMounted, setIsEditSheetMounted] = useState(false);

  // Defense in depth for a reused/backgrounded screen instance whose sheet
  // was left open from an earlier visit.
  useFocusEffect(
    useCallback(() => {
      editSheetRef.current?.forceClose();
    }, [])
  );

  if (!customer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Customer" onBackPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="person-outline"
            title="We couldn't load this customer."
            description="They may still be syncing, or no longer exist."
          />
        </View>
      </SafeAreaView>
    );
  }

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
    editImage.reset();
    if (isEditSheetMounted) {
      editSheetRef.current?.expand();
    } else {
      setIsEditSheetMounted(true);
    }
  }

  async function handleSaveEdit() {
    if (isSavingEdit) return;
    const nameError = editName.trim().length === 0 ? 'Enter a name' : undefined;
    const emailError = !isValidEmail(editEmail) ? 'Enter a valid email' : undefined;
    setEditNameError(nameError);
    setEditEmailError(emailError);
    if (nameError || emailError || !userId) return;

    setIsSavingEdit(true);
    // Optional chaining, not customer.avatarUrl -- TS can't carry the
    // early-return narrowing at the top of the component into a nested
    // async function's closure (the same reason customerId was extracted
    // as its own const above instead of using customer.id inline here).
    const previousAvatarUrl = customer?.avatarUrl;
    // Tracks a just-uploaded object updateCustomer hasn't successfully
    // referenced yet -- if that write then fails, the catch block below
    // (which needs to see this, hence declared outside the try) cleans it
    // up so the upload doesn't outlive the save it was part of.
    let uploadedButUnsavedUrl: string | undefined;
    try {
      let avatarUrl = previousAvatarUrl;
      if (editImage.localUri) {
        avatarUrl = await uploadCustomerAvatar(userId, customerId, editImage.localUri);
        uploadedButUnsavedUrl = avatarUrl;
      } else if (editImage.removed) {
        avatarUrl = undefined;
      }

      await updateCustomer(userId, customerId, {
        name: editName.trim(),
        email: editEmail.trim(),
        company: editCompany.trim() || undefined,
        notes: editNotes.trim() || undefined,
        avatarUrl,
        imageType: avatarUrl ? editImage.imageType : undefined,
      });
      uploadedButUnsavedUrl = undefined;
      avatarDebugLog('edit customer: database update succeeded', { customerId, avatarUrl });

      if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
        deleteAvatarByUrl(previousAvatarUrl);
      }
      editSheetRef.current?.close();
    } catch (saveError) {
      avatarDebugLog('edit customer: save FAILED', {
        customerId,
        message: saveError instanceof Error ? saveError.message : String(saveError),
      });
      // updateCustomer already set a calm store-level error; keep the sheet
      // open with the entered values intact so the user can retry.
      if (uploadedButUnsavedUrl) {
        deleteAvatarByUrl(uploadedButUnsavedUrl);
      }
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader
        title="Customer"
        onBackPress={() => router.back()}
        rightIcon="create-outline"
        onRightPress={openEditSheet}
        rightAccessibilityLabel="Edit customer"
      />
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.xl }}>
            <ThemeAwareCard style={[styles.identityCard, { padding: spacing.xl }]}>
              <CustomerAvatar
                name={customer.name}
                color={customer.avatarColor}
                avatarUrl={customer.avatarUrl}
                imageType={customer.imageType}
                size={76}
              />
              <Text
                style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}
                numberOfLines={1}
              >
                {customer.name}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                {customer.email}
              </Text>
              {customer.company ? (
                <View
                  style={[
                    styles.companyPill,
                    { backgroundColor: colors.softBlue, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginTop: spacing.md },
                  ]}
                >
                  <Ionicons name="briefcase-outline" size={12} color={colors.softBlueText} />
                  <Text
                    style={[typography.caption, { color: colors.softBlueText, marginLeft: spacing.xs }]}
                    numberOfLines={1}
                  >
                    {customer.company}
                  </Text>
                </View>
              ) : null}
            </ThemeAwareCard>

            <ThemeAwareCard variant="hero" style={{ marginTop: spacing.lg }}>
              <Text style={[typography.caption, { color: colors.heroSurfaceTextMuted }]}>Total Received</Text>
              <Text style={[typography.h1, { color: colors.heroSurfaceText, marginTop: spacing.xs }]} numberOfLines={1}>
                {formatCurrency(stats.totalReceived)}
              </Text>
            </ThemeAwareCard>

            <View style={[styles.statsRow, { marginTop: spacing.sm, gap: spacing.sm }]}>
              <StatTile label="Payments" value={String(stats.totalRequests)} style={{ flex: 1 }} />
              <StatTile label="Outstanding" value={formatCurrency(stats.outstanding)} style={{ flex: 1 }} />
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <PrimaryButton label="Request Payment" onPress={handleRequestPayment} icon="arrow-forward" />
            </View>

            <View style={[styles.historyHeaderRow, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>History</Text>
              {history.length > 0 ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {history.length} {history.length === 1 ? 'request' : 'requests'}
                </Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <ThemeAwareCard style={{ padding: spacing.sm }}>
            <EmptyState
              icon="document-text-outline"
              title="No requests yet"
              description="Requests sent to this customer will show up here."
              actionLabel="Request Payment"
              onActionPress={handleRequestPayment}
            />
          </ThemeAwareCard>
        }
        renderItem={renderHistoryRow}
      />
      {isEditSheetMounted ? (
        <AppBottomSheet ref={editSheetRef} initialIndex={0} scrollable>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Edit Customer</Text>
          <CustomerImagePicker
            name={editName}
            avatarColor={customer.avatarColor}
            imageUri={editImage.displayUri}
            hasImage={editImage.hasImage}
            imageType={editImage.imageType}
            onImageTypeChange={editImage.setImageType}
            onPress={editImage.handlePress}
          />
          <TextField
            label="Name"
            value={editName}
            onChangeText={setEditName}
            error={editNameError}
            returnKeyType="next"
          />
          <TextField
            label="Email"
            value={editEmail}
            onChangeText={setEditEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={editEmailError}
            returnKeyType="next"
          />
          <TextField label="Company (Optional)" value={editCompany} onChangeText={setEditCompany} returnKeyType="next" />
          <TextField label="Notes (Optional)" value={editNotes} onChangeText={setEditNotes} multiline />
          <PrimaryButton label="Save Changes" onPress={handleSaveEdit} loading={isSavingEdit} />
        </AppBottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  identityCard: { alignItems: 'center' },
  companyPill: { flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row' },
  historyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
