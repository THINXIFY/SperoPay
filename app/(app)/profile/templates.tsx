import { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { SelectField } from '../../../src/components/SelectField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { EmptyState } from '../../../src/components/EmptyState';
import { SkeletonLoader } from '../../../src/components/SkeletonLoader';
import { AppRefreshControl } from '../../../src/components/AppRefreshControl';
import { ConfirmationModal } from '../../../src/components/ConfirmationModal';
import { useTemplateStore } from '../../../src/store/templateStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useRefreshTemplateData } from '../../../src/store/useRefreshTemplateData';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { isValidAmount } from '../../../src/utils/validators';
import type { ExpiryOption, Template } from '../../../src/types';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
];

// The form sheet's content (title + 3 fields + an expiry row + the submit
// button) runs taller than AppBottomSheet's default 40% first snap point --
// on first open that left the submit button below the fold with no obvious
// affordance to scroll to it, which is what actually made "+" look broken
// (it opened something, just not visibly a usable form). A single tall
// snap point guarantees the whole form -- including the button -- is
// visible without a hidden scroll on first open, on any of these devices.
const FORM_SHEET_SNAP_POINTS = ['90%'];
const EXPIRY_SHEET_SNAP_POINTS = ['40%'];

export default function TemplatesScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const templates = useTemplateStore((state) => state.templates);
  const addTemplate = useTemplateStore((state) => state.addTemplate);
  const updateTemplate = useTemplateStore((state) => state.updateTemplate);
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);
  const status = useTemplateStore((state) => state.status);
  const listError = useTemplateStore((state) => state.error);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);
  const userId = useAuthStore((state) => state.user?.id);
  const { refresh, isRefreshing } = useRefreshTemplateData();

  const formSheetRef = useRef<BottomSheet>(null);
  const expirySheetRef = useRef<BottomSheet>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>('7d');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Neither sheet is rendered at all until first opened -- see
  // request/amount.tsx for why this is the correct fix: gorhom's imperative
  // .expand() silently no-ops if called before native layout resolves,
  // which an always-mounted sheet's first .expand() call can race.
  // AppBottomSheet's `initialIndex` prop is the layout-aware, declarative
  // alternative used on first mount below.
  const [isFormSheetMounted, setIsFormSheetMounted] = useState(false);
  const [isExpirySheetMounted, setIsExpirySheetMounted] = useState(false);

  function openFormSheet() {
    if (isFormSheetMounted) {
      formSheetRef.current?.expand();
    } else {
      setIsFormSheetMounted(true);
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
      formSheetRef.current?.forceClose();
      expirySheetRef.current?.forceClose();
    }, [])
  );

  function openCreateForm() {
    if (isDeleting) return;
    setEditingId(null);
    setName('');
    setAmount('');
    setDescription('');
    setExpiryOption('7d');
    setError(undefined);
    openFormSheet();
  }

  function openEditForm(template: Template) {
    if (isDeleting) return;
    setEditingId(template.id);
    setName(template.name);
    setAmount(String(template.amount));
    setDescription(template.description ?? '');
    setExpiryOption(template.expiryOption);
    setError(undefined);
    openFormSheet();
  }

  async function handleSave() {
    if (isSaving) return;
    const numericAmount = Number(amount);
    if (name.trim().length === 0 || !isValidAmount(numericAmount)) {
      setError('Enter a name and a valid amount');
      return;
    }
    if (!userId) return;
    const input = {
      name: name.trim(),
      amount: numericAmount,
      description: description.trim() || undefined,
      expiryOption,
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
    if (isDeleting) return;
    prefillDraft({
      amount: String(template.amount),
      description: template.description,
      expiryOption: template.expiryOption,
    });
    router.push('/request/amount');
  }

  const expiryLabel = expiryLabelFor(expiryOption);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader
        title="Templates"
        onBackPress={() => router.back()}
        rightIcon="add"
        onRightPress={openCreateForm}
        rightAccessibilityLabel="Add template"
      />
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, flexGrow: 1 }}
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
                    <SkeletonLoader width={36} height={36} style={{ borderRadius: radius.full }} />
                    <View style={{ marginLeft: spacing.sm, flex: 1, gap: spacing.xs }}>
                      <SkeletonLoader width="55%" height={14} />
                      <SkeletonLoader width="35%" height={11} />
                    </View>
                    <SkeletonLoader width={60} height={14} />
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
              title="No templates yet"
              description="Create a template for payments you request often, like a fixed-price service."
              actionLabel="Create Template"
              onActionPress={openCreateForm}
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleUseTemplate(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${formatCurrency(item.amount)} USDC. Use this template`}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.base,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
            ]}
          >
            <View style={styles.topRow}>
              <View
                style={[
                  styles.iconChip,
                  { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.softMint },
                ]}
              >
                <Ionicons name="copy-outline" size={16} color={colors.softMintText} />
              </View>
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.description ? (
                  <Text
                    style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}
                    numberOfLines={1}
                  >
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm }]} numberOfLines={1}>
                {formatCurrency(item.amount)} USDC
              </Text>
            </View>
            <View
              style={[
                styles.footerRow,
                { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            >
              <Text style={[typography.caption, { color: colors.textMuted }]}>{expiryCaptionFor(item.expiryOption)}</Text>
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => openEditForm(item)}
                  disabled={isDeleting}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                  hitSlop={8}
                  style={({ pressed }) => [styles.actionButton, { opacity: pressed || isDeleting ? 0.5 : 1 }]}
                >
                  <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => setDeleteTarget(item)}
                  disabled={isDeleting}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.actionButton,
                    { marginLeft: spacing.sm, opacity: pressed || isDeleting ? 0.5 : 1 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
      />

      {isFormSheetMounted ? (
        <AppBottomSheet ref={formSheetRef} initialIndex={0} snapPoints={FORM_SHEET_SNAP_POINTS} scrollable>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
            {editingId ? 'Edit Template' : 'New Template'}
          </Text>
          <TextField label="Name" value={name} onChangeText={setName} error={error} placeholder="Template name" />
          <TextField label="Amount (USDC)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1000" />
          <TextField
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What does this template cover?"
          />
          <View style={{ marginBottom: spacing.base }}>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Expires In
            </Text>
            <SelectField icon="time-outline" label={expiryLabel} onPress={openExpirySheet} />
          </View>
          <PrimaryButton
            label={editingId ? 'Save Changes' : 'Create Template'}
            onPress={handleSave}
            loading={isSaving}
          />
        </AppBottomSheet>
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
              style={[styles.expiryOptionRow, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
              {expiryOption === option.value ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          ))}
        </AppBottomSheet>
      ) : null}

      <ConfirmationModal
        visible={deleteTarget !== null}
        title="Delete this template?"
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

function expiryLabelFor(value: ExpiryOption): string {
  return EXPIRY_OPTIONS.find((opt) => opt.value === value)?.label ?? '7 days';
}

function expiryCaptionFor(value: ExpiryOption): string {
  return value === 'never' ? 'Never expires' : `Expires in ${expiryLabelFor(value)}`;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  iconChip: { alignItems: 'center', justifyContent: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { alignItems: 'center', justifyContent: 'center' },
  expiryOptionRow: { flexDirection: 'row', alignItems: 'center' },
});
