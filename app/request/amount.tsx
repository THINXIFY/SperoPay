import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AmountInput } from '../../src/components/AmountInput';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { SelectField } from '../../src/components/SelectField';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { isValidAmount } from '../../src/utils/validators';

// Both selector sheets have small, fixed content (a heading + one option
// row) — a single snap point sized to that content means .expand() opens
// fully in one motion instead of the default two-stage 40%/70%. Hoisted to
// module scope so AppBottomSheet (which snapPoints-compares via
// JSON.stringify) isn't handed a fresh array identity on every keystroke.
const SHEET_SNAP_POINTS = ['30%'];

export default function AmountScreen() {
  const { colors, spacing, typography } = useTheme();
  const amount = useRequestDraftStore((state) => state.amount);
  const setAmount = useRequestDraftStore((state) => state.setAmount);
  const reset = useRequestDraftStore((state) => state.reset);

  const stablecoinSheetRef = useRef<BottomSheet>(null);
  const networkSheetRef = useRef<BottomSheet>(null);

  // Neither sheet is rendered at all until the user has actually asked to
  // open it once -- not just given index={-1} and left mounted. This is a
  // structural guarantee, not a reactive one: there is nothing in the tree
  // for gorhom to animate, position, or show a backdrop for before that
  // point, so there's no mount-time window (layout-measurement race,
  // reused-screen-instance state, or otherwise) in which either sheet could
  // be visible without the user having tapped its trigger. Once mounted, a
  // sheet stays mounted (closed) so re-opening it doesn't remount gorhom's
  // internals every time.
  const [isStablecoinSheetMounted, setIsStablecoinSheetMounted] = useState(false);
  const [isNetworkSheetMounted, setIsNetworkSheetMounted] = useState(false);

  useEffect(() => {
    if (isStablecoinSheetMounted) stablecoinSheetRef.current?.expand();
  }, [isStablecoinSheetMounted]);

  useEffect(() => {
    if (isNetworkSheetMounted) networkSheetRef.current?.expand();
  }, [isNetworkSheetMounted]);

  function openStablecoinSheet() {
    if (isStablecoinSheetMounted) {
      stablecoinSheetRef.current?.expand();
    } else {
      setIsStablecoinSheetMounted(true);
    }
  }

  function openNetworkSheet() {
    if (isNetworkSheetMounted) {
      networkSheetRef.current?.expand();
    } else {
      setIsNetworkSheetMounted(true);
    }
  }

  // Defense in depth for the (much narrower, now-unreachable-on-a-genuinely-
  // fresh-visit) case where React Navigation reuses a backgrounded instance
  // of this screen that had a sheet left open from an earlier visit.
  useFocusEffect(
    useCallback(() => {
      stablecoinSheetRef.current?.forceClose();
      networkSheetRef.current?.forceClose();
    }, [])
  );

  function handleClose() {
    reset();
    router.back();
  }

  function handleContinue() {
    if (!isValidAmount(Number(amount))) return;
    router.push('/request/details');
  }

  const canContinue = isValidAmount(Number(amount));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Smart Request" onBackPress={handleClose} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[typography.h1, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.lg }]}>
          How much do you want to request?
        </Text>

        <AmountInput value={amount} onChange={setAmount} />

        <View style={{ marginTop: spacing.lg }}>
          <SelectField icon="ellipse" label="USDC" onPress={openStablecoinSheet} />
        </View>

        <Pressable
          onPress={openNetworkSheet}
          style={({ pressed }) => [styles.networkCompactRow, { marginTop: spacing.md, opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Network: Solana. Change"
          hitSlop={8}
        >
          <Ionicons name="flash-outline" size={13} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.xs / 2 }]}>
            Network: Solana
          </Text>
          <Ionicons name="chevron-forward" size={12} color={colors.textMuted} style={{ marginLeft: spacing.xs / 2 }} />
        </Pressable>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Continue" onPress={handleContinue} disabled={!canContinue} />
      </View>

      {isStablecoinSheetMounted ? (
        <AppBottomSheet ref={stablecoinSheetRef} snapPoints={SHEET_SNAP_POINTS} scrollable>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Stablecoin</Text>
          <SheetOption label="USDC" selected />
        </AppBottomSheet>
      ) : null}

      {isNetworkSheetMounted ? (
        <AppBottomSheet ref={networkSheetRef} snapPoints={SHEET_SNAP_POINTS} scrollable>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Network</Text>
          <SheetOption label="Solana" selected />
        </AppBottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

function SheetOption({ label, selected }: { label: string; selected: boolean }) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.optionRow,
        {
          backgroundColor: selected ? colors.softMint : 'transparent',
          borderRadius: radius.md,
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.base,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.softMintText} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  networkCompactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
});
