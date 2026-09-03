import { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { usePaymentDefaultsStore } from '../../../src/store/paymentDefaultsStore';
import { useWalletStore } from '../../../src/store/walletStore';
import type { ExpiryOption } from '../../../src/types';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
];

export default function PaymentDefaultsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  const setDefaultExpiryOption = usePaymentDefaultsStore((state) => state.setDefaultExpiryOption);
  const wallet = useWalletStore((state) => state.wallet);
  const expirySheetRef = useRef<BottomSheet>(null);

  // Not rendered at all until first opened -- see request/amount.tsx for
  // why this is the correct fix: gorhom's imperative .expand() silently
  // no-ops if called before native layout resolves, which an always-mounted
  // sheet's first .expand() call can race. AppBottomSheet's `initialIndex`
  // prop is the layout-aware, declarative alternative used on first mount.
  const [isExpirySheetMounted, setIsExpirySheetMounted] = useState(false);

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
      expirySheetRef.current?.forceClose();
    }, [])
  );

  const expiryLabel = EXPIRY_OPTIONS.find((opt) => opt.value === defaultExpiryOption)?.label ?? '7 days';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Payment Defaults" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <ThemeAwareCard style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Default Stablecoin</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>USDC</Text>
          </ThemeAwareCard>
          <ThemeAwareCard style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Default Network</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>Solana</Text>
          </ThemeAwareCard>
        </View>

        <Pressable
          onPress={openExpirySheet}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.base },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Default Expiry</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>{expiryLabel}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/(app)/profile/wallet')}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.base },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Default Receiving Wallet</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]} numberOfLines={1}>
              {wallet?.address ?? 'Not set'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </ScrollView>

      {isExpirySheetMounted ? (
        <AppBottomSheet ref={expirySheetRef} initialIndex={0}>
          <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Default Expiry</Text>
          {EXPIRY_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                setDefaultExpiryOption(option.value);
                expirySheetRef.current?.close();
              }}
              style={[styles.optionRow, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
              {defaultExpiryOption === option.value ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          ))}
        </AppBottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
});
