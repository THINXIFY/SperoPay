import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { resolveAuthGateRedirect, type AuthGateMode } from '../utils/authRouting';

interface AuthGateProps {
  mode: AuthGateMode;
  children: React.ReactNode;
}

export function AuthGate({ mode, children }: AuthGateProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);
  const profileStatus = useProfileStore((state) => state.status);
  const hasCompletedOnboarding = useProfileStore((state) => state.profile?.onboardingCompleted ?? false);

  // Both the auth session and the profile fetch must settle before a
  // redirect decision can be trusted — the profile fetch is now a network
  // call (Phase 2B), not local storage rehydration, so this gate can be
  // "loading" for longer than it used to. Deciding on the default
  // (hasCompletedOnboarding: false) before it resolves would send an
  // already-onboarded user into onboarding, where re-entering the business
  // profile overwrites real data.
  if (!authHasHydrated) return null;
  if (isAuthenticated && (profileStatus === 'idle' || profileStatus === 'loading')) return null;

  const redirectTo = resolveAuthGateRedirect(mode, { isAuthenticated, hasCompletedOnboarding, isPasswordRecovery });
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return <>{children}</>;
}
