import { useRef } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { IconButton } from '../../src/components/IconButton';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { EmptyState } from '../../src/components/EmptyState';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { QRCodeCard } from '../../src/components/QRCodeCard';
import { Logo } from '../../src/components/Logo';
import { useRequestStore } from '../../src/store/requestStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useWalletStore } from '../../src/store/walletStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { formatCurrency } from '../../src/utils/formatCurrency';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PublicPaymentScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const profile = useProfileStore((state) => state.profile);
  const wallet = useWalletStore((state) => state.wallet);
  const transaction = useTransactionStore((state) => (request ? state.getTransactionForRequest(request.id) : undefined));
  const qrSheetRef = useRef<BottomSheet>(null);

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
          <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
        </View>
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="alert-circle-outline"
            title="Request unavailable"
            description="This payment request is no longer available."
          />
        </View>
      </SafeAreaView>
    );
  }

  const businessName = profile.businessName?.trim() || profile.displayName || 'Spero merchant';

  async function handleCopyWallet() {
    if (!wallet) return;
    await Clipboard.setStringAsync(wallet.address);
    Alert.alert('Copied', 'Wallet address copied to clipboard.');
  }

  async function handleCopyAmount() {
    if (!request) return;
    await Clipboard.setStringAsync(String(request.amount));
    Alert.alert('Copied', 'Amount copied to clipboard.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
        <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl, alignItems: 'center' }}>
        <Logo size={44} />
        <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.md }]}>{businessName}</Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
          Payment Request
        </Text>

        <Text style={[typography.display, { color: colors.textPrimary, marginTop: spacing.lg }]}>
          {formatCurrency(request.amount)}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          {request.amount} {request.currency}
        </Text>
        {request.description ? (
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            {request.description}
          </Text>
        ) : null}

        {request.status === 'pending' ? (
          <>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.lg }]}>
              Network: <Text style={{ color: colors.textPrimary }}>{request.network}</Text>
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Requested by {profile.displayName || businessName}
            </Text>
            {request.expiresAt ? (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                Expires {formatDate(request.expiresAt)}
              </Text>
            ) : null}

            <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.sm }}>
              <PrimaryButton label="Pay with Wallet" onPress={() => router.push(`/pay/demo?id=${request.id}`)} />
              <SecondaryButton label="Scan QR" onPress={() => qrSheetRef.current?.expand()} />
            </View>
          </>
        ) : null}

        {request.status === 'paid' ? (
          <ThemeAwareCard style={{ width: '100%', marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
              Payment already completed
            </Text>
            <View style={{ marginTop: spacing.md, width: '100%', gap: spacing.sm }}>
              <View style={styles.summaryRow}>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Amount</Text>
                <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{formatCurrency(request.amount)}</Text>
              </View>
              {transaction ? (
                <View style={styles.summaryRow}>
                  <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Paid Date</Text>
                  <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{formatDate(transaction.paidAt)}</Text>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Merchant</Text>
                <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{businessName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Payment ID</Text>
                <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{request.paymentCode}</Text>
              </View>
            </View>
            <View style={{ width: '100%', marginTop: spacing.lg }}>
              <SecondaryButton label="View Receipt" onPress={() => router.push(`/request/receipt?id=${request.id}`)} />
            </View>
          </ThemeAwareCard>
        ) : null}

        {request.status === 'expired' ? (
          <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="time-outline" size={32} color={colors.textMuted} />
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
              This payment request has expired.
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
              Contact the requester for a new payment link.
            </Text>
          </View>
        ) : null}

        {request.status === 'cancelled' ? (
          <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="close-circle-outline" size={32} color={colors.textMuted} />
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
              This payment request is no longer active.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <AppBottomSheet ref={qrSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' }]}>
          Scan to Pay
        </Text>
        <QRCodeCard value={request.paymentLink} />
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <View style={styles.summaryRow}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Amount</Text>
            <Pressable onPress={handleCopyAmount} style={styles.copyRow} accessibilityRole="button" accessibilityLabel="Copy amount">
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {request.amount} {request.currency}
              </Text>
              <Ionicons name="copy-outline" size={16} color={colors.textMuted} style={{ marginLeft: spacing.xs }} />
            </Pressable>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Network</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{request.network}</Text>
          </View>
          {wallet ? (
            <View>
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Receiving Wallet</Text>
              <Pressable
                onPress={handleCopyWallet}
                style={[styles.copyRow, { marginTop: spacing.xs / 2 }]}
                accessibilityRole="button"
                accessibilityLabel="Copy wallet address"
              >
                <Text style={[typography.bodySmall, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                  {wallet.address}
                </Text>
                <Ionicons name="copy-outline" size={16} color={colors.textMuted} style={{ marginLeft: spacing.xs }} />
              </Pressable>
            </View>
          ) : null}
        </View>
        <View
          style={{
            backgroundColor: colors.softRed,
            borderRadius: radius.md,
            padding: spacing.base,
            marginTop: spacing.lg,
          }}
        >
          <Text style={[typography.bodySmall, { color: colors.softRedText }]}>
            Only send USDC using the Solana network. Using another asset or network may result in loss of funds.
          </Text>
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyRow: { flexDirection: 'row', alignItems: 'center' },
});
