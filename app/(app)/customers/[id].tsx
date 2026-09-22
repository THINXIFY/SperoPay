import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Share, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { TAB_BAR_CONTENT_HEIGHT } from '../../../src/components/BottomNavigation';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { CustomerImagePicker } from '../../../src/components/CustomerImagePicker';
import { StatTile } from '../../../src/components/StatTile';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { RequestCard } from '../../../src/components/RequestCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { SecondaryButton } from '../../../src/components/SecondaryButton';
import { TextButton } from '../../../src/components/TextButton';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { ConfirmationModal } from '../../../src/components/ConfirmationModal';
import { TextField } from '../../../src/components/TextField';
import { AppRefreshControl } from '../../../src/components/AppRefreshControl';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestStore } from '../../../src/store/requestStore';
import { useTransactionStore } from '../../../src/store/transactionStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../../../src/store/paymentDefaultsStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useRefreshCustomerData } from '../../../src/store/useRefreshCustomerData';
import { useCustomerImageEditor } from '../../../src/hooks/useCustomerImageEditor';
import { uploadCustomerAvatar, deleteAvatarByUrl } from '../../../src/services/storage/avatarUpload';
import { avatarDebugLog } from '../../../src/utils/avatarDebugLog';
import { getCustomerStats } from '../../../src/utils/getCustomerStats';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { SUPPORTED_ASSETS } from '../../../src/config/assets';
import { getDateLabel } from '../../../src/utils/getDateLabel';
import { isValidEmail } from '../../../src/utils/validators';
import { getCustomerPortalUrl } from '../../../src/utils/customerPortalLink';
import type { PaymentRequest } from '../../../src/types';

export default function CustomerDetailScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === id));
  const requests = useRequestStore((state) => state.requests);
  const transactions = useTransactionStore((state) => state.transactions);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);
  const updateCustomer = useCustomerStore((state) => state.updateCustomer);
  const ensurePortalToken = useCustomerStore((state) => state.ensurePortalToken);
  const regeneratePortalToken = useCustomerStore((state) => state.regeneratePortalToken);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  const userId = useAuthStore((state) => state.user?.id);
  const { refresh: refreshCustomerData, isRefreshing } = useRefreshCustomerData();

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

  const stats = useMemo(() => getCustomerStats(id ?? '', requests, transactions), [id, requests, transactions]);
  // Never a single combined number across assets (spec section 14) -- see
  // getCustomerStats's own comment.
  const statsCurrencies = useMemo(() => SUPPORTED_ASSETS.filter((asset) => stats.byCurrency[asset]), [stats]);

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

  const portalSheetRef = useRef<BottomSheet>(null);
  const [isPortalSheetMounted, setIsPortalSheetMounted] = useState(false);
  const [isLoadingPortalToken, setIsLoadingPortalToken] = useState(false);
  const [isRegeneratingPortalToken, setIsRegeneratingPortalToken] = useState(false);
  const [regenerateModalVisible, setRegenerateModalVisible] = useState(false);

  // Defense in depth for a reused/backgrounded screen instance whose sheet
  // was left open from an earlier visit.
  useFocusEffect(
    useCallback(() => {
      editSheetRef.current?.forceClose();
      portalSheetRef.current?.forceClose();
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

  async function openPortalSheet() {
    if (!customer || !userId) return;
    if (isPortalSheetMounted) portalSheetRef.current?.expand();
    else setIsPortalSheetMounted(true);

    if (!customer.portalToken) {
      setIsLoadingPortalToken(true);
      try {
        await ensurePortalToken(userId, customer.id);
      } catch {
        Alert.alert("Couldn't Set Up Portal", "We couldn't set up the client portal. Check your connection and try again.");
      } finally {
        setIsLoadingPortalToken(false);
      }
    }
  }

  async function handleCopyPortalLink() {
    if (!customer?.portalToken) return;
    await Clipboard.setStringAsync(getCustomerPortalUrl(customer.portalToken));
    Alert.alert('Copied', 'Portal link copied to clipboard.');
  }

  async function handleSharePortalLink() {
    if (!customer?.portalToken) return;
    const link = getCustomerPortalUrl(customer.portalToken);
    await Share.share({ message: link, url: link });
  }

  function handleOpenPortal() {
    if (!customer?.portalToken) return;
    portalSheetRef.current?.close();
    router.push(`/c/${customer.portalToken}`);
  }

  async function handleConfirmRegenerate() {
    if (!userId || !customer || isRegeneratingPortalToken) return;
    setIsRegeneratingPortalToken(true);
    try {
      await regeneratePortalToken(userId, customer.id);
      setRegenerateModalVisible(false);
    } catch {
      Alert.alert("Couldn't Regenerate Link", "We couldn't regenerate the portal link. Check your connection and try again.");
    } finally {
      setIsRegeneratingPortalToken(false);
    }
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
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: TAB_BAR_CONTENT_HEIGHT + spacing.xl, gap: spacing.md }}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refreshCustomerData} />}
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
              {statsCurrencies.length === 0 ? (
                <Text style={[typography.h1, { color: colors.heroSurfaceText, marginTop: spacing.xs }]} numberOfLines={1}>
                  {formatCurrency(0)} USDC
                </Text>
              ) : (
                statsCurrencies.map((asset) => (
                  <Text
                    key={asset}
                    style={[typography.h1, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}
                    numberOfLines={1}
                  >
                    {formatCurrency(stats.byCurrency[asset]!.totalReceived)} {asset}
                  </Text>
                ))
              )}
            </ThemeAwareCard>

            <View style={[styles.statsRow, { marginTop: spacing.sm, gap: spacing.sm }]}>
              <StatTile label="Payments" value={String(stats.totalRequests)} style={{ flex: 1 }} />
              <StatTile
                label="Outstanding"
                value={
                  statsCurrencies.length === 0
                    ? `${formatCurrency(0)} USDC`
                    : statsCurrencies.map((asset) => `${formatCurrency(stats.byCurrency[asset]!.outstanding)} ${asset}`).join(' · ')
                }
                style={{ flex: 1 }}
              />
            </View>

            <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
              <PrimaryButton label="Request Payment" onPress={handleRequestPayment} icon="arrow-forward" />
              <SecondaryButton label="Client Portal" icon="globe-outline" onPress={openPortalSheet} />
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
            placeholder="Customer name"
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextField
            label="Email"
            value={editEmail}
            onChangeText={setEditEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={editEmailError}
            placeholder="name@example.com"
            returnKeyType="next"
          />
          <TextField
            label="Company (Optional)"
            value={editCompany}
            onChangeText={setEditCompany}
            placeholder="Company name"
            returnKeyType="next"
          />
          <TextField
            label="Notes (Optional)"
            value={editNotes}
            onChangeText={setEditNotes}
            placeholder="Add a note about this customer"
            multiline
          />
          <PrimaryButton label="Save Changes" onPress={handleSaveEdit} loading={isSavingEdit} />
        </AppBottomSheet>
      ) : null}

      {isPortalSheetMounted ? (
        <AppBottomSheet ref={portalSheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.xs }]}>Client Portal</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
            A secure link where {customer.name.split(' ')[0]} can see their payment activity with you and pay outstanding
            requests.
          </Text>

          {isLoadingPortalToken ? (
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.lg }]}>Setting up…</Text>
          ) : customer.portalToken ? (
            <View
              style={[
                styles.portalLinkRow,
                { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base, marginBottom: spacing.lg },
              ]}
            >
              <Text style={[typography.bodySmall, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                {getCustomerPortalUrl(customer.portalToken)}
              </Text>
            </View>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <PrimaryButton label="Open Portal" onPress={handleOpenPortal} disabled={!customer.portalToken} />
            <SecondaryButton label="Copy Link" icon="copy-outline" onPress={handleCopyPortalLink} disabled={!customer.portalToken} />
            <SecondaryButton label="Share" icon="share-outline" onPress={handleSharePortalLink} disabled={!customer.portalToken} />
          </View>

          {customer.portalToken ? (
            <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
              <TextButton
                label="Regenerate Link"
                tone="danger"
                onPress={() => {
                  portalSheetRef.current?.close();
                  setRegenerateModalVisible(true);
                }}
              />
            </View>
          ) : null}
        </AppBottomSheet>
      ) : null}

      <ConfirmationModal
        visible={regenerateModalVisible}
        title="Regenerate portal link?"
        description="The current link will stop working immediately. Anyone with the old link will no longer be able to open this customer's portal."
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        onConfirm={handleConfirmRegenerate}
        onCancel={() => setRegenerateModalVisible(false)}
        loading={isRegeneratingPortalToken}
        icon="refresh-outline"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  identityCard: { alignItems: 'center' },
  companyPill: { flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row' },
  historyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  portalLinkRow: { borderWidth: 1 },
});
