import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme';
import { Logo } from '../src/components/Logo';
import { useAuthStore } from '../src/store/authStore';
import { useProfileStore } from '../src/store/profileStore';
import { resolveInitialRoute } from '../src/utils/authRouting';

const SPLASH_DURATION_MS = 1200;

export default function SplashScreen() {
  const { colors, spacing, typography } = useTheme();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const profileStatus = useProfileStore((state) => state.status);
  const hasCompletedOnboarding = useProfileStore((state) => state.profile?.onboardingCompleted ?? false);
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);

  // Two independent gates must both clear before we redirect:
  //  1. A minimum-duration timer, so the branded splash never flashes by too
  //     fast even when the auth session restore is instant.
  //  2. Auth hydration, plus — only for an authenticated session — the
  //     profile fetch settling (Phase 2B: onboarding completion now lives in
  //     profiles.onboarding_completed, a network call, not local storage).
  //     An unauthenticated visitor never waits on a fetch that will never
  //     happen. Deciding on the default (hasCompletedOnboarding: false)
  //     before the fetch resolves would send an already-onboarded user into
  //     onboarding, where re-entering the business profile overwrites real
  //     data.
  // The two gates run independently: a fast device isn't held back past
  // ~1.2s, and a slow fetch isn't cut short by the timer.
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const storesHydrated =
    authHasHydrated && (!isAuthenticated || (profileStatus !== 'idle' && profileStatus !== 'loading'));

  useEffect(() => {
    const timer = setTimeout(() => setMinDurationElapsed(true), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minDurationElapsed || !storesHydrated) {
      return;
    }

    router.replace(resolveInitialRoute({ isAuthenticated, hasCompletedOnboarding, isPasswordRecovery }));
  }, [minDurationElapsed, storesHydrated, isAuthenticated, hasCompletedOnboarding, isPasswordRecovery]);

  return (
    <View style={[styles.container, { backgroundColor: colors.heroSurface }]}>
      <Logo size={72} />
      <Text style={[typography.h1, { color: colors.heroSurfaceText, marginTop: spacing.lg }]}>SperoPay</Text>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.primaryAction, marginTop: spacing.sm, position: 'absolute', bottom: 64 },
        ]}
      >
        Request. Share. Get Paid.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
