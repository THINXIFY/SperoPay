import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';

export function WelcomeVisual() {
  const { colors, radius } = useTheme();

  return (
    <View style={styles.visualWrap}>
      <View
        style={[
          styles.visualCardBack,
          { backgroundColor: colors.heroSurface, borderRadius: radius.xl },
        ]}
      />
      <View
        style={[
          styles.visualCardFront,
          { backgroundColor: colors.primaryAction, borderRadius: radius.xl },
        ]}
      />
      <View
        style={[
          styles.visualDot,
          { backgroundColor: colors.surface, borderRadius: radius.full, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

export default function WelcomeScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: spacing.xl }]}>
        <WelcomeVisual />
        <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.xxl }]}>
          Stablecoin payments made simple.
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Request payments, share a link or QR code, and keep your payment activity organized.
        </Text>
      </View>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Get Started" onPress={() => router.push('/(auth)/sign-up')} />
        <SecondaryButton label="I already have an account" onPress={() => router.push('/(auth)/login')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center' },
  visualWrap: { height: 220, justifyContent: 'center' },
  visualCardBack: { position: 'absolute', width: '80%', height: 140, top: 20, left: '4%', opacity: 0.9 },
  visualCardFront: { position: 'absolute', width: '70%', height: 130, top: 60, left: '16%' },
  visualDot: { position: 'absolute', width: 56, height: 56, top: 10, right: '10%', borderWidth: 1 },
});
