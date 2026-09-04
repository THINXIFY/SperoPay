import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { Logo } from '../../src/components/Logo';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { useProfileStore } from '../../src/store/profileStore';
import { resolveInitialRoute } from '../../src/utils/authRouting';

// How long the "Email verified" confirmation stays on screen before
// continuing on its own -- long enough to register as a real confirmation,
// short enough that it never reads as a delay. Matches this pass's
// 120-220ms micro-interaction range for the checkmark's own entrance, but
// the screen itself holds a bit longer so the message is actually legible.
const VERIFIED_DISPLAY_MS = 1400;

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
  const [failed, setFailed] = useState(false);
  const [showVerified, setShowVerified] = useState(false);
  // Keyed on the code itself, not a bare boolean: a second, genuinely
  // different deep link tapped while this screen is still mounted (e.g. the
  // user requested two reset emails) must still be processed, while a
  // duplicate delivery of the exact same code must not be re-submitted.
  const attemptedCode = useRef<string | null>(null);
  // Guards the transition-start effect below against re-firing.
  const hasStartedTransition = useRef(false);

  useEffect(() => {
    const code = params.code;
    if (!code) {
      setFailed(true);
      return;
    }
    if (attemptedCode.current === code) return;
    attemptedCode.current = code;
    setFailed(false);

    exchangeAuthCode(code, params.sb_flow_id).catch(() => {
      setFailed(true);
    });
  }, [params.code, params.sb_flow_id, exchangeAuthCode]);

  useEffect(() => {
    if (failed || !isAuthenticated || hasStartedTransition.current) return;
    hasStartedTransition.current = true;

    // Reads the profile store directly at navigation time, rather than
    // subscribing to hasCompletedOnboarding as a dependency -- it's a
    // separate, independent network fetch (see app/_layout.tsx) that can
    // change value *while this effect's own timer is still pending*, and
    // this effect must never re-run once the transition has started (see
    // hasStartedTransition above). An earlier version depended on it
    // directly: React reran this effect (cancelling the pending timer via
    // its cleanup) the moment the value changed mid-transition, and the
    // hasStartedTransition guard then skipped scheduling a replacement --
    // leaving the "Email verified" screen showing with no navigation ever
    // firing again. Reading the store directly (fresh at the moment it's
    // actually used, in both branches below) avoids that class of bug
    // entirely -- and even a value that's technically stale by the time
    // the timer fires is harmless, since the destination route is itself
    // wrapped in AuthGate, which re-checks onboarding status fresh on its
    // own render and self-corrects (same reasoning as login.tsx/
    // sign-up.tsx not navigating explicitly after a successful sign-in).
    const currentHasCompletedOnboarding = useProfileStore.getState().profile?.onboardingCompleted ?? false;

    // A password-recovery exchange must land on Reset Password immediately
    // -- no "verified" moment applies to it, and resolveInitialRoute
    // already routes it there via isPasswordRecovery regardless of
    // onboarding status. Only a genuine signup/email-confirmation exchange
    // (the only other deep link this screen handles -- see
    // src/utils/authDeepLink.ts) gets the brief success screen.
    if (isPasswordRecovery) {
      router.replace(resolveInitialRoute({ isAuthenticated, hasCompletedOnboarding: currentHasCompletedOnboarding, isPasswordRecovery }));
      return;
    }

    setShowVerified(true);
    const timer = setTimeout(() => {
      const hasCompletedOnboardingAtNavigation = useProfileStore.getState().profile?.onboardingCompleted ?? false;
      router.replace(
        resolveInitialRoute({ isAuthenticated, hasCompletedOnboarding: hasCompletedOnboardingAtNavigation, isPasswordRecovery })
      );
    }, VERIFIED_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [failed, isAuthenticated, isPasswordRecovery]);

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

  if (showVerified) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.heroSurface }]}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.primaryActionSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={30} color={colors.primaryAction} />
        </View>
        <Text style={[typography.h2, { color: colors.heroSurfaceText, textAlign: 'center', marginTop: spacing.lg }]}>
          Email verified
        </Text>
        <Text
          style={[typography.body, { color: colors.heroSurfaceTextMuted, marginTop: spacing.sm, textAlign: 'center' }]}
        >
          Your Spero account is ready.
        </Text>
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
