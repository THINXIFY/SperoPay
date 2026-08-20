export interface AuthRoutingState {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
}

export type AuthGateMode = 'require-auth' | 'require-guest';

export function resolveInitialRoute(state: AuthRoutingState): string {
  if (!state.isAuthenticated) return '/(auth)/welcome';
  if (!state.hasCompletedOnboarding) return '/(onboarding)/usage-type';
  return '/(app)/home';
}

export function resolveAuthGateRedirect(mode: AuthGateMode, state: AuthRoutingState): string | null {
  if (mode === 'require-auth' && !state.isAuthenticated) {
    return '/(auth)/welcome';
  }
  if (mode === 'require-guest' && state.isAuthenticated) {
    return resolveInitialRoute(state);
  }
  return null;
}
