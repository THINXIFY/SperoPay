import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { Logo } from '../../src/components/Logo';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { useHasCompletedOnboarding } from '../../src/store/onboardingStore';
import { resolveInitialRoute } from '../../src/utils/authRouting';

// The single landing point for both password-recovery and sign-up-confirmation
// deep links (see src/utils/authDeepLink.ts). Deliberately NOT inside the
// (auth) route group, so it is never subject to AuthGate's require-guest
// redirect — exchanging the code can make isAuthenticated true (a recovery
// session) before we've had a chance to route the user anywhere.
export default function AuthCallbackScreen() {
  const { colors, spacing, typography } = useTheme();
  const params = useLocalSearchParams<{ code?: string; sb_flow_id?: string }>();
  const exchangeAuthCode = useAuthStore((state) => state.exchangeAuthCode);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);
  const hasCompletedOnboarding = useHasCompletedOnboarding();
  const [failed, setFailed] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const code = params.code;
    if (!code) {
      setFailed(true);
      return;
    }

    exchangeAuthCode(code, params.sb_flow_id).catch(() => {
      setFailed(true);
    });
  }, [params.code, params.sb_flow_id, exchangeAuthCode]);

  useEffect(() => {
    if (failed || !isAuthenticated) return;
    router.replace(resolveInitialRoute({ isAuthenticated, hasCompletedOnboarding, isPasswordRecovery }));
  }, [failed, isAuthenticated, hasCompletedOnboarding, isPasswordRecovery]);

  if (failed) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>
          This link is no longer valid
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
          It may have expired, already been used, or been opened on a different device. Request a new one from Sign
          In.
        </Text>
        <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.xl, width: '100%' }}>
          <PrimaryButton label="Back to Sign In" onPress={() => router.replace('/(auth)/welcome')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.heroSurface }]}>
      <Logo size={56} />
      <ActivityIndicator color={colors.primaryAction} style={{ marginTop: spacing.xl }} />
      <Text style={[typography.bodySmall, { color: colors.primaryAction, marginTop: spacing.md }]}>
        Finishing up...
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
