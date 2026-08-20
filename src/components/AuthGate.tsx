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
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);

  if (!hasHydrated) {
    return null;
  }

  const redirectTo = resolveAuthGateRedirect(mode, { isAuthenticated, hasCompletedOnboarding });
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return <>{children}</>;
}
