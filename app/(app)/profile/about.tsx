import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { TAB_BAR_CONTENT_HEIGHT } from '../../../src/components/BottomNavigation';
import { Logo } from '../../../src/components/Logo';

const APP_VERSION = '1.0.0';

export default function AboutScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="About SperoPay" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: TAB_BAR_CONTENT_HEIGHT + spacing.xl, alignItems: 'center' }}>
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
          <Logo size={64} />
        </View>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>SperoPay</Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs }]}>Version {APP_VERSION}</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xl, textAlign: 'center' }]}>
          SperoPay helps freelancers, agencies, and small businesses request stablecoin payments and get paid faster,
          with a simple link or QR code.
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xxl, textAlign: 'center' }]}>
          Terms of Service and Privacy Policy are coming in a future update.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
