import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { resolveAuthGateRedirect, type AuthGateMode } from '../utils/authRouting';

interface AuthGateProps {
  mode: AuthGateMode;
  children: React.ReactNode;
}

/**
 * Wraps a top-level layout and reactively redirects if the current auth state
 * doesn't match what that segment requires. This is the backstop for the fact
 * that a real Supabase session can end reactively (not just via the Sign Out
 * button) — the splash screen's one-time redirect alone isn't enough once
 * sessions can expire mid-use.
 */
export function AuthGate({ mode, children }: AuthGateProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const onboardingHasHydrated = useOnboardingStore((state) => state.hasHydrated);

  // Both stores must be hydrated before a redirect decision can be trusted.
  // `resolveAuthGateRedirect`'s require-guest branch routes on
  // `hasCompletedOnboarding`, which reads `false` until the onboarding store
  // finishes rehydrating. Deciding on that default would send an already-
  // onboarded user into the onboarding flow, where re-entering the business
  // profile overwrites it — and nothing re-evaluates afterwards to undo it.
  // This mirrors the two-store gate `app/index.tsx` already applies.
  if (!authHasHydrated || !onboardingHasHydrated) {
    return null;
  }

  const redirectTo = resolveAuthGateRedirect(mode, { isAuthenticated, hasCompletedOnboarding });
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return <>{children}</>;
}
