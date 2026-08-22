import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { truncateHash } from '../../src/utils/truncateHash';

export default function PaymentSuccessScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const profile = useProfileStore((state) => state.profile);
  const transaction = useTransactionStore((state) => (request ? state.getTransactionForRequest(request.id) : undefined));

  if (!request || request.status !== 'paid') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
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

  const businessName = profile?.businessName?.trim() || profile?.displayName || 'Spero merchant';

  function handleDone() {
    router.replace('/(app)/home');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl, alignItems: 'center' }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: radius.full,
            backgroundColor: colors.primaryAction,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: spacing.xl,
          }}
        >
          <Ionicons name="checkmark" size={48} color={colors.primaryActionText} />
        </View>

        <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
          Payment Received
        </Text>
        <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.md }]}>
          {request.amount} {request.currency}
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
          Paid to {businessName}.
        </Text>

        <ThemeAwareCard style={{ width: '100%', marginTop: spacing.xl }}>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Merchant</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{businessName}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Customer</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {customer?.name ?? 'No customer'}
            </Text>
          </View>
          {request.description ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Description</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {request.description}
              </Text>
            </View>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Network</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{request.network}</Text>
          </View>
          {transaction ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Transaction</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {truncateHash(transaction.txHash)}
              </Text>
            </View>
          ) : null}
        </ThemeAwareCard>

        <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="View Receipt" onPress={() => router.push(`/request/receipt?id=${request.id}`)} />
          <PrimaryButton label="Done" onPress={handleDone} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
