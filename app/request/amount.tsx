import { useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AmountInput } from '../../src/components/AmountInput';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { isValidAmount } from '../../src/utils/validators';

export default function AmountScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const amount = useRequestDraftStore((state) => state.amount);
  const setAmount = useRequestDraftStore((state) => state.setAmount);
  const reset = useRequestDraftStore((state) => state.reset);

  const stablecoinSheetRef = useRef<BottomSheet>(null);
  const networkSheetRef = useRef<BottomSheet>(null);

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
      <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
        <Text style={[typography.h1, { color: colors.textPrimary, textAlign: 'center' }]}>
          How much do you want to request?
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          <AmountInput value={amount} onChange={setAmount} />
        </View>

        <Pressable
          onPress={() => stablecoinSheetRef.current?.expand()}
          style={[
            styles.selectorRow,
            { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.base, marginTop: spacing.lg },
          ]}
        >
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>USDC</Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => networkSheetRef.current?.expand()}
          style={[
            styles.networkCard,
            { backgroundColor: colors.softMint, borderRadius: radius.md, padding: spacing.base, marginTop: spacing.md },
          ]}
        >
          <Text style={[typography.bodyMedium, { color: colors.softMintText }]}>On Solana</Text>
          <Text style={[typography.caption, { color: colors.softMintText, marginTop: spacing.xs / 2 }]}>
            Fast · Low fees · Secure
          </Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Continue" onPress={handleContinue} disabled={!canContinue} />
      </View>

      <AppBottomSheet ref={stablecoinSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Stablecoin</Text>
        <View style={[styles.optionRow, { paddingVertical: spacing.md }]}>
          <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>USDC</Text>
          <Ionicons name="checkmark" size={20} color={colors.primaryAction} />
        </View>
      </AppBottomSheet>

      <AppBottomSheet ref={networkSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Network</Text>
        <View style={[styles.optionRow, { paddingVertical: spacing.md }]}>
          <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>Solana</Text>
          <Ionicons name="checkmark" size={20} color={colors.primaryAction} />
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  selectorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, borderWidth: 1 },
  networkCard: {},
  optionRow: { flexDirection: 'row', alignItems: 'center' },
});
