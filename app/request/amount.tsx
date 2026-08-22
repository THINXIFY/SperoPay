import { useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AmountInput } from '../../src/components/AmountInput';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { SelectField } from '../../src/components/SelectField';
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
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[typography.h1, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.lg }]}>
          How much do you want to request?
        </Text>

        <AmountInput value={amount} onChange={setAmount} />

        <View style={{ marginTop: spacing.lg }}>
          <SelectField icon="ellipse" label="USDC" onPress={() => stablecoinSheetRef.current?.expand()} />
        </View>

        <Pressable
          onPress={() => networkSheetRef.current?.expand()}
          style={[
            styles.networkRow,
            { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base, marginTop: spacing.md },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Network: Solana. Change"
        >
          <View
            style={[
              styles.networkIconChip,
              { backgroundColor: colors.softMint, borderRadius: radius.full, marginRight: spacing.sm },
            ]}
          >
            <Ionicons name="flash" size={14} color={colors.softMintText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Solana</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
              Fast · Low fees
            </Text>
          </View>
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Change ›</Text>
        </Pressable>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Continue" onPress={handleContinue} disabled={!canContinue} />
      </View>

      <AppBottomSheet ref={stablecoinSheetRef} snapPoints={['30%']} scrollable>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Stablecoin</Text>
        <View style={[styles.optionRow, { paddingVertical: spacing.md }]}>
          <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>USDC</Text>
          <Ionicons name="checkmark" size={20} color={colors.primaryAction} />
        </View>
      </AppBottomSheet>

      <AppBottomSheet ref={networkSheetRef} snapPoints={['30%']} scrollable>
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
  networkRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  networkIconChip: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
});
