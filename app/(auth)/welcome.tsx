import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { useAuthStore } from '../../src/store/authStore';

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
  const { colors, spacing, radius, typography } = useTheme();
  const sessionExpiredNotice = useAuthStore((state) => state.sessionExpiredNotice);
  const clearSessionExpiredNotice = useAuthStore((state) => state.clearSessionExpiredNotice);
  // Captured once so the banner doesn't disappear mid-render the instant the
  // effect below clears the store flag for next time.
  const [showSessionExpiredNotice] = useState(sessionExpiredNotice);

  useEffect(() => {
    if (sessionExpiredNotice) {
      clearSessionExpiredNotice();
    }
    // Intentionally runs once on mount only.
    // eslint-disable-next-line
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: spacing.xl }]}>
        {showSessionExpiredNotice ? (
          <View
            style={{ backgroundColor: colors.softRed, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}
          >
            <Text style={[typography.bodyMedium, { color: colors.softRedText }]}>Your session expired</Text>
            <Text style={[typography.caption, { color: colors.softRedText, marginTop: spacing.xs / 2 }]}>
              Sign in again to continue.
            </Text>
          </View>
        ) : null}
        <WelcomeVisual />
        <Text style={[typography.display, { color: colors.textPrimary, marginTop: spacing.xxl }]}>Spero</Text>
        <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
          Request. Share. Get Paid.
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          Simple crypto payments for modern businesses.
        </Text>
      </View>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Create Account" onPress={() => router.push('/(auth)/sign-up')} />
        <SecondaryButton label="Sign In" onPress={() => router.push('/(auth)/login')} />
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
