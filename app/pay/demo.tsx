import { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { IconButton } from '../../src/components/IconButton';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { formatCurrency } from '../../src/utils/formatCurrency';

export default function DemoPaymentScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const [isProcessing, setIsProcessing] = useState(false);

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
          <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
        </View>
        <EmptyState
          icon="alert-circle-outline"
          title="Request unavailable"
          description="This payment request is no longer available."
        />
      </SafeAreaView>
    );
  }

  if (isProcessing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.center, { padding: spacing.xl }]}>
          <ActivityIndicator size="large" color={colors.primaryAction} />
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            Preparing your payment…
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
            In the full version, this would confirm your payment on Solana.
          </Text>
          <View style={{ marginTop: spacing.xl, width: '100%' }}>
            <PrimaryButton label="Back to Payment Request" onPress={() => router.back()} />
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
        <View style={[styles.badge, { backgroundColor: colors.softLavender, borderRadius: radius.full, marginBottom: spacing.lg }]}>
          <Ionicons name="flask-outline" size={28} color={colors.softLavenderText} />
        </View>
        <Text style={[typography.h1, { color: colors.textPrimary, textAlign: 'center' }]}>Demo Payment</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
          This is a simulated payment for the Spero prototype. No real funds will move.
        </Text>

        <View style={[styles.summaryCard, { borderColor: colors.border, borderRadius: radius.lg, padding: spacing.base, marginTop: spacing.xl }]}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>You're paying</Text>
          <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs }]}>
            {formatCurrency(request.amount)}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
            {request.amount} {request.currency} on {request.network}
          </Text>
        </View>

        <View style={{ marginTop: spacing.xl, width: '100%' }}>
          <PrimaryButton label="Continue" onPress={() => setIsProcessing(true)} />
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
