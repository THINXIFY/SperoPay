import { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { EmptyState } from '../../../src/components/EmptyState';
import { ConfirmationModal } from '../../../src/components/ConfirmationModal';
import { useTemplateStore } from '../../../src/store/templateStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { useAuthStore } from '../../../src/store/authStore';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { isValidAmount } from '../../../src/utils/validators';
import type { ExpiryOption, Template } from '../../../src/types';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
];

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

  // Force closed on every focus (including first) -- see request/amount.tsx
  // for why: native-stack keeps a visited screen mounted, and gorhom's
  // sheets own their open/closed state internally after the initial mount.
  useFocusEffect(
    useCallback(() => {
      formSheetRef.current?.forceClose();
      expirySheetRef.current?.forceClose();
    }, [])
  );

  function openCreateForm() {
    setEditingId(null);
    setName('');
    setAmount('');
    setDescription('');
    setExpiryOption('7d');
    setError(undefined);
    formSheetRef.current?.expand();
  }

  function openEditForm(template: Template) {
    setEditingId(template.id);
    setName(template.name);
    setAmount(String(template.amount));
    setDescription(template.description ?? '');
    setExpiryOption(template.expiryOption);
    setError(undefined);
    formSheetRef.current?.expand();
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
    prefillDraft({
      amount: String(template.amount),
      description: template.description,
      expiryOption: template.expiryOption,
    });
    router.push('/request/amount');
  }

  const expiryLabel = EXPIRY_OPTIONS.find((opt) => opt.value === expiryOption)?.label ?? '7 days';

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
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListEmptyComponent={
          status === 'loading' ? (
            <ActivityIndicator color={colors.primaryAction} style={{ marginTop: spacing.xl }} />
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
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleUseTemplate(item)}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.base },
            ]}
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                  {formatCurrency(item.amount)} USDC
                </Text>
              </View>
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => openEditForm(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                  hitSlop={8}
                  style={{ marginRight: spacing.md }}
                >
                  <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => setDeleteTarget(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
      />

      <AppBottomSheet ref={formSheetRef} scrollable>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
          {editingId ? 'Edit Template' : 'New Template'}
        </Text>
        <TextField label="Name" value={name} onChangeText={setName} error={error} placeholder="Website Development" />
        <TextField label="Amount (USDC)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1000" />
        <TextField label="Description (Optional)" value={description} onChangeText={setDescription} />
        <Pressable
          onPress={() => expirySheetRef.current?.expand()}
          style={[
            styles.expiryRow,
            { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base, marginBottom: spacing.base },
          ]}
        >
          <Text style={[typography.caption, { color: colors.textMuted }]}>Expires In</Text>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{expiryLabel}</Text>
        </Pressable>
        <PrimaryButton
          label={editingId ? 'Save Changes' : 'Create Template'}
          onPress={handleSave}
          loading={isSaving}
        />
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
            style={[styles.expiryOptionRow, { paddingVertical: spacing.md }]}
          >
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
            {expiryOption === option.value ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
          </Pressable>
        ))}
      </AppBottomSheet>

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

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  expiryRow: { borderWidth: 1 },
  expiryOptionRow: { flexDirection: 'row', alignItems: 'center' },
});
