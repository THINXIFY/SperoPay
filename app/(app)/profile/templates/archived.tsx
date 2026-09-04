import { useMemo, useState } from 'react';
import { View, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../../src/theme/useTheme';
import { AppHeader } from '../../../../src/components/AppHeader';
import { EmptyState } from '../../../../src/components/EmptyState';
import { ConfirmationModal } from '../../../../src/components/ConfirmationModal';
import { PaymentTemplateCard } from '../../../../src/components/PaymentTemplateCard';
import { useTemplateStore } from '../../../../src/store/templateStore';
import { useCustomerStore } from '../../../../src/store/customerStore';
import { useAuthStore } from '../../../../src/store/authStore';
import type { Template } from '../../../../src/types';

// Deliberately minimal (per the "only if it can remain simple" brief): no
// favoriting, no "Use Template", no create form here -- just Restore (the
// one action that matters for an archived template) and permanent Delete,
// reusing the same card as the active list so it doesn't read as a
// different feature.
export default function ArchivedTemplatesScreen() {
  const { colors, spacing } = useTheme();
  const templates = useTemplateStore((state) => state.templates);
  const setArchived = useTemplateStore((state) => state.setArchived);
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);
  const customers = useCustomerStore((state) => state.customers);
  const userId = useAuthStore((state) => state.user?.id);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const archivedTemplates = useMemo(() => templates.filter((t) => t.isArchived), [templates]);

  async function handleRestore(template: Template) {
    if (!userId || busyId) return;
    setBusyId(template.id);
    try {
      await setArchived(userId, template.id, false);
    } catch {
      Alert.alert("Couldn't Restore", "We couldn't restore this template. Try again.");
    } finally {
      setBusyId(null);
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

  function openActions(template: Template) {
    Alert.alert(template.name, undefined, [
      { text: 'Restore', onPress: () => handleRestore(template) },
      { text: 'Delete', style: 'destructive', onPress: () => setDeleteTarget(template) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Archived Templates" onBackPress={() => router.back()} />
      <FlatList
        data={archivedTemplates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="archive-outline"
            title="No archived templates"
            description="Templates you archive from Payment Templates will show up here."
          />
        }
        renderItem={({ item }) => (
          <View style={{ opacity: busyId === item.id ? 0.6 : 1 }}>
            <PaymentTemplateCard
              template={item}
              customer={customers.find((c) => c.id === item.customerId)}
              disabled={busyId === item.id}
              onPress={() => openActions(item)}
              onOpenActions={() => openActions(item)}
            />
          </View>
        )}
      />

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
