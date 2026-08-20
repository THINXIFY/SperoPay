import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme';
import { Logo } from '../src/components/Logo';
import { useAuthStore } from '../src/store/authStore';
import { useOnboardingStore } from '../src/store/onboardingStore';
import { resolveInitialRoute } from '../src/utils/authRouting';

const SPLASH_DURATION_MS = 1200;

export default function SplashScreen() {
  const { colors, spacing, typography } = useTheme();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const onboardingHasHydrated = useOnboardingStore((state) => state.hasHydrated);

  // Two independent gates must both clear before we redirect:
  //  1. A minimum-duration timer, so the branded splash never flashes by too
  //     fast even when AsyncStorage rehydration is instant.
  //  2. Both persisted stores reporting `hasHydrated`, so we never redirect
  //     on the default in-memory state (isAuthenticated: false,
  //     hasCompletedOnboarding: false) before the real persisted values have
  //     loaded — which would briefly bounce a returning, already-authenticated
  //     user to the welcome screen.
  // The two gates run independently: a fast device isn't held back past
  // ~1.2s, and a slow rehydration isn't cut short by the timer.
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const storesHydrated = authHasHydrated && onboardingHasHydrated;

  useEffect(() => {
    const timer = setTimeout(() => setMinDurationElapsed(true), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minDurationElapsed || !storesHydrated) {
      return;
    }

    router.replace(resolveInitialRoute({ isAuthenticated, hasCompletedOnboarding }));
  }, [minDurationElapsed, storesHydrated, isAuthenticated, hasCompletedOnboarding]);

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
