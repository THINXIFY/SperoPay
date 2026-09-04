import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { resolveAuthGateRedirect, shouldShowProfileLoadError, type AuthGateMode } from '../utils/authRouting';
import { ProfileLoadError } from './ProfileLoadError';

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
  const userId = useAuthStore((state) => state.user?.id);
  const userFullName = useAuthStore((state) => state.user?.fullName);

  // Both the auth session and the profile fetch must settle before a
  // redirect decision can be trusted — the profile fetch is now a network
  // call (Phase 2B), not local storage rehydration, so this gate can be
  // "loading" for longer than it used to. Deciding on the default
  // (hasCompletedOnboarding: false) before it resolves would send an
  // already-onboarded user into onboarding, where re-entering the business
  // profile overwrites real data.
  if (!authHasHydrated) return null;
  if (isAuthenticated && (profileStatus === 'idle' || profileStatus === 'loading')) return null;

  // A FAILED fetch is not the same thing as "this profile doesn't exist
  // yet" -- profile stays null either way, and hasCompletedOnboarding
  // would default to false in both cases. Without this check, any transient
  // network/session hiccup while loading an already-onboarded user's
  // profile would silently route them back through onboarding, discarding
  // nothing server-side but making it *look* like their account was reset.
  // Show a retryable error instead of ever computing a redirect from data
  // that failed to load.
  if (shouldShowProfileLoadError(isAuthenticated, profileStatus)) {
    return (
      <ProfileLoadError
        onRetry={async () => {
          if (userId) await useProfileStore.getState().loadForUser(userId, userFullName);
        }}
      />
    );
  }

  const redirectTo = resolveAuthGateRedirect(mode, { isAuthenticated, hasCompletedOnboarding, isPasswordRecovery });
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return <>{children}</>;
}
