import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { IconButton } from '../../src/components/IconButton';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useAuthStore } from '../../src/store/authStore';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { isRequestExpired } from '../../src/utils/expiry';

type Stage = 'idle' | 'detecting' | 'confirming' | 'received' | 'failed';

const STAGE_LABELS: Record<'detecting' | 'confirming' | 'received', string> = {
  detecting: 'Payment detected…',
  confirming: 'Confirming payment…',
  received: 'Payment received!',
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DemoPaymentScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const beginPaymentConfirmation = useRequestStore((state) => state.beginPaymentConfirmation);
  const completePayment = useRequestStore((state) => state.completePayment);
  const userId = useAuthStore((state) => state.user?.id);
  const [stage, setStage] = useState<Stage>('idle');
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  if (stage === 'idle') {
    if (request.status === 'paid') {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
            <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
          </View>
          <View style={[styles.center, { padding: spacing.xl }]}>
            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
              This request has already been paid.
            </Text>
            <View style={{ marginTop: spacing.xl, width: '100%' }}>
              <PrimaryButton
                label="View Receipt"
                onPress={() => router.replace(`/request/receipt?id=${request.id}`)}
              />
            </View>
          </View>
        </SafeAreaView>
      );
    }

    if (request.status === 'confirming') {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
            <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
          </View>
          <View style={[styles.center, { padding: spacing.xl }]}>
            <ActivityIndicator size="large" color={colors.primaryAction} />
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
              This payment is already being confirmed.
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    if (request.status === 'expired' || request.status === 'cancelled' || isRequestExpired(request)) {
      // A request still marked 'pending' but past its expiry window reuses the expired copy,
      // not the cancelled copy.
      const showExpired = request.status !== 'cancelled';
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
            <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
          </View>
          <View style={{ flex: 1 }}>
            <EmptyState
              icon={showExpired ? 'time-outline' : 'close-circle-outline'}
              title={
                showExpired
                  ? 'This payment request has expired.'
                  : 'This payment request is no longer active.'
              }
              description={
                showExpired
                  ? 'Contact the requester for a new payment link.'
                  : 'Payment is no longer possible for this request.'
              }
            />
          </View>
        </SafeAreaView>
      );
    }
  }

  async function handleContinue() {
    if (!userId) return;
    setStage('detecting');
    const started = await beginPaymentConfirmation(userId, request!.id).catch(() => false);
    if (!started) {
      setStage('failed');
      return;
    }
    await delay(700);

    // The payment itself must still resolve even if the user backs out mid-flight, so the
    // store mutations below are never gated. Only UI-visible effects check the mount flag.
    if (isMountedRef.current) setStage('confirming');
    await delay(900);

    const transaction = await completePayment(userId, request!.id).catch(() => null);
    if (!transaction) {
      if (isMountedRef.current) setStage('failed');
      return;
    }

    if (!isMountedRef.current) return;
    setStage('received');
    Alert.alert('Payment received', `${formatCurrency(transaction.amount)} from ${customer?.name ?? 'your customer'}`);
    await delay(500);
    if (!isMountedRef.current) return;
    router.replace(`/pay/success?id=${request!.id}`);
  }

  function handleRetry() {
    setStage('idle');
  }

  if (stage === 'detecting' || stage === 'confirming' || stage === 'received') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.center, { padding: spacing.xl }]}>
          <ActivityIndicator size="large" color={colors.primaryAction} />
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            {STAGE_LABELS[stage]}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
            This is a simulated payment for the Spero prototype.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'failed') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.center, { padding: spacing.xl }]}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            We couldn't confirm this payment. Try again.
          </Text>
          <View style={{ marginTop: spacing.xl, width: '100%' }}>
            <PrimaryButton label="Try Again" onPress={handleRetry} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
        <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
      </View>
      <View style={[styles.center, { padding: spacing.xl }]}>
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.softLavender, borderRadius: radius.full, marginBottom: spacing.lg },
          ]}
        >
          <Ionicons name="flask-outline" size={28} color={colors.softLavenderText} />
        </View>
        <Text style={[typography.h1, { color: colors.textPrimary, textAlign: 'center' }]}>Demo Payment</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
          This is a simulated payment for the Spero prototype. No real funds will move.
        </Text>

        <View
          style={[
            styles.summaryCard,
            { borderColor: colors.border, borderRadius: radius.lg, padding: spacing.base, marginTop: spacing.xl },
          ]}
        >
          <Text style={[typography.caption, { color: colors.textMuted }]}>You're paying</Text>
          <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs }]}>
            {formatCurrency(request.amount)}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
            {request.amount} {request.currency} on {request.network}
          </Text>
        </View>

        <View style={{ marginTop: spacing.xl, width: '100%' }}>
          <PrimaryButton label="Continue" onPress={handleContinue} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { width: '100%', borderWidth: 1, alignItems: 'center' },
});
