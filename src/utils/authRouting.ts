export interface AuthRoutingState {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  isPasswordRecovery?: boolean;
}

export type AuthGateMode = 'require-auth' | 'require-guest';

const RESET_PASSWORD_ROUTE = '/(auth)/reset-password';

export function resolveInitialRoute(state: AuthRoutingState): string {
  if (state.isPasswordRecovery) return RESET_PASSWORD_ROUTE;
  if (!state.isAuthenticated) return '/(auth)/welcome';
  if (!state.hasCompletedOnboarding) return '/(onboarding)/usage-type';
  return '/(app)/home';
}

export function resolveAuthGateRedirect(mode: AuthGateMode, state: AuthRoutingState): string | null {
  // A recovery session is neither an ordinary logged-in session nor a guest:
  // it must never reach Home/Onboarding (require-auth redirects it to Reset
  // Password), but it must also not be bounced out of the (auth) group the
  // way a normal authenticated session would be (require-guest treats it as
  // guest-equivalent and leaves it alone).
  if (state.isPasswordRecovery) {
    return mode === 'require-guest' ? null : RESET_PASSWORD_ROUTE;
  }
  if (mode === 'require-auth' && !state.isAuthenticated) {
    return '/(auth)/welcome';
  }
  if (mode === 'require-guest' && state.isAuthenticated) {
    return resolveInitialRoute(state);
  }
  return null;
}
