import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { EmptyState } from '../../src/components/EmptyState';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { AppActionSheet, type ActionSheetItem } from '../../src/components/AppActionSheet';
import { RecurringPlanCard } from '../../src/components/RecurringPlanCard';
import {
  RecurringPlanFilterSheet,
  RECURRING_PLAN_FILTER_OPTIONS,
  type RecurringPlanFilter,
} from '../../src/components/RecurringPlanFilterSheet';
import { useRecurringPlanStore } from '../../src/store/recurringPlanStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useAuthStore } from '../../src/store/authStore';
import type { RecurringPlan } from '../../src/types';

// The exact same "has this plan finished" rule RecurringPlanCard itself
// uses to show the Ended badge -- the filter and the badge must always
// agree, or "Completed" in the filter would show plans the card itself
// still labels Paused.
function isPlanCompleted(plan: RecurringPlan): boolean {
  return !plan.active && plan.maxOccurrences != null && plan.occurrencesGenerated >= plan.maxOccurrences;
}

export default function RecurringPlansScreen() {
  const { colors, spacing, typography } = useTheme();
  const userId = useAuthStore((state) => state.user?.id);
  const plans = useRecurringPlanStore((state) => state.plans);
  const status = useRecurringPlanStore((state) => state.status);
  const loadForUser = useRecurringPlanStore((state) => state.loadForUser);
  const pausePlan = useRecurringPlanStore((state) => state.pausePlan);
  const resumePlan = useRecurringPlanStore((state) => state.resumePlan);
  const endPlan = useRecurringPlanStore((state) => state.endPlan);
  const customers = useCustomerStore((state) => state.customers);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [endModalVisible, setEndModalVisible] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [filter, setFilter] = useState<RecurringPlanFilter>('all');
  const actionSheetRef = useRef<BottomSheet>(null);
  const [isActionSheetMounted, setIsActionSheetMounted] = useState(false);
  const filterSheetRef = useRef<BottomSheet>(null);
  const [isFilterSheetMounted, setIsFilterSheetMounted] = useState(false);

  useEffect(() => {
    if (userId) loadForUser(userId);
    // Loading once per mount (and again if the signed-in user changes) is
    // sufficient here -- unlike Request Detail, nothing external mutates a
    // recurring plan while this screen is open except this screen's own
    // actions, which already update the store locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      actionSheetRef.current?.forceClose();
      filterSheetRef.current?.forceClose();
    }, [])
  );

  function openFilterSheet() {
    if (isFilterSheetMounted) filterSheetRef.current?.expand();
    else setIsFilterSheetMounted(true);
  }

  const filteredPlans = useMemo(() => {
    switch (filter) {
      case 'active':
        return plans.filter((p) => p.active);
      case 'paused':
        return plans.filter((p) => !p.active && !isPlanCompleted(p));
      case 'completed':
        return plans.filter((p) => isPlanCompleted(p));
      case 'all':
      default:
        return plans;
    }
  }, [plans, filter]);

  const activeFilterLabel = RECURRING_PLAN_FILTER_OPTIONS.find((f) => f.value === filter)?.label ?? 'All plans';

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  function openActionsFor(planId: string) {
    setSelectedPlanId(planId);
    if (isActionSheetMounted) actionSheetRef.current?.expand();
    else setIsActionSheetMounted(true);
  }

  async function handlePause() {
    if (!userId || !selectedPlan) return;
    actionSheetRef.current?.close();
    await pausePlan(userId, selectedPlan.id);
  }

  async function handleResume() {
    if (!userId || !selectedPlan) return;
    actionSheetRef.current?.close();
    await resumePlan(userId, selectedPlan.id);
  }

  function handleRequestEnd() {
    actionSheetRef.current?.close();
    setEndModalVisible(true);
  }

  async function handleConfirmEnd() {
    if (!userId || !selectedPlanId || isEnding) return;
    setIsEnding(true);
    try {
      await endPlan(userId, selectedPlanId);
      setEndModalVisible(false);
    } finally {
      setIsEnding(false);
    }
  }

  const actions: ActionSheetItem[] = selectedPlan
    ? [
        ...(selectedPlan.active
          ? [{ key: 'pause', label: 'Pause', icon: 'pause-circle-outline' as const, onPress: handlePause }]
          : [{ key: 'resume', label: 'Resume', icon: 'play-circle-outline' as const, onPress: handleResume }]),
        { key: 'end', label: 'End recurring plan', icon: 'stop-circle-outline', destructive: true, onPress: handleRequestEnd },
      ]
    : [];

  function renderItem({ item }: { item: RecurringPlan }) {
    return (
      <RecurringPlanCard
        plan={item}
        customer={customers.find((c) => c.id === item.customerId)}
        onPress={() => openActionsFor(item.id)}
        onMorePress={() => openActionsFor(item.id)}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader
        title="Recurring Payments"
        onBackPress={() => router.back()}
        rightIcon="stats-chart-outline"
        onRightPress={() => router.push('/automation')}
        rightAccessibilityLabel="Automation overview"
      />
      {plans.length > 0 ? (
        <View style={[styles.filterRow, { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }]}>
          <Pressable
            onPress={openFilterSheet}
            accessibilityRole="button"
            accessibilityLabel={`Filter plans. Currently ${activeFilterLabel}`}
            style={({ pressed }) => [
              styles.filterPill,
              {
                backgroundColor: filter === 'all' ? colors.surface : colors.heroSurface,
                borderColor: colors.border,
                borderRadius: 999,
                paddingHorizontal: spacing.md,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="options-outline" size={14} color={filter === 'all' ? colors.textPrimary : colors.heroSurfaceText} />
            <Text style={[typography.bodySmall, { color: filter === 'all' ? colors.textPrimary : colors.heroSurfaceText, marginLeft: spacing.xs }]}>
              {activeFilterLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={filteredPlans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={status === 'loading'} onRefresh={() => userId && loadForUser(userId)} />}
        renderItem={renderItem}
        ListEmptyComponent={
          status !== 'loaded' ? null : plans.length === 0 ? (
            <EmptyState
              icon="repeat-outline"
              title="No recurring payments yet"
              description="Automate repeat billing for regular customers."
              actionLabel="Create recurring plan"
              onActionPress={() => router.push('/recurring/create')}
            />
          ) : (
            <EmptyState
              icon="funnel-outline"
              title={`No ${activeFilterLabel.toLowerCase()}`}
              description="Try a different filter to see more of your recurring payments."
            />
          )
        }
      />
      {plans.length > 0 ? (
        <View style={[styles.footer, { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }]}>
          <PrimaryButton label="Create Recurring Payment" onPress={() => router.push('/recurring/create')} />
        </View>
      ) : null}

      {isActionSheetMounted ? (
        <AppActionSheet
          ref={actionSheetRef}
          initialIndex={0}
          title={selectedPlan?.description || 'Recurring payment'}
          actions={actions}
        />
      ) : null}

      {isFilterSheetMounted ? (
        <RecurringPlanFilterSheet ref={filterSheetRef} initialIndex={0} value={filter} onSelect={setFilter} />
      ) : null}

      <ConfirmationModal
        visible={endModalVisible}
        title="End this recurring plan?"
        description="No more requests will be generated. Requests already sent to the customer are not affected."
        confirmLabel="End Plan"
        cancelLabel="Keep Plan"
        onConfirm={handleConfirmEnd}
        onCancel={() => setEndModalVisible(false)}
        loading={isEnding}
        icon="stop-circle-outline"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  footer: {},
  filterRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  filterPill: { flexDirection: 'row', alignItems: 'center', height: 34, borderWidth: 1 },
});
