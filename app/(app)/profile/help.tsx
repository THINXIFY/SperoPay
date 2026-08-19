import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';

export default function HelpScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Help & Support" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
        <ThemeAwareCard>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Contact Support</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            support@speropay.app
          </Text>
        </ThemeAwareCard>
        <ThemeAwareCard>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>How do I get paid?</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Create a request from the Home tab or the center Request button, then share the link or QR code with your
            customer.
          </Text>
        </ThemeAwareCard>
        <ThemeAwareCard>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Where do payments go?</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Payments are designed to go directly to the receiving wallet configured in Profile → Wallet Settings.
          </Text>
        </ThemeAwareCard>
      </ScrollView>
    </SafeAreaView>
  );
}
