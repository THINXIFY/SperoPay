import { resolveInitialRoute, resolveAuthGateRedirect } from '../authRouting';

describe('resolveInitialRoute', () => {
  it('routes to Welcome when unauthenticated', () => {
    expect(resolveInitialRoute({ isAuthenticated: false, hasCompletedOnboarding: false })).toBe('/(auth)/welcome');
    expect(resolveInitialRoute({ isAuthenticated: false, hasCompletedOnboarding: true })).toBe('/(auth)/welcome');
  });

  it('routes to onboarding when authenticated but not onboarded', () => {
    expect(resolveInitialRoute({ isAuthenticated: true, hasCompletedOnboarding: false })).toBe(
      '/(onboarding)/usage-type'
    );
  });

  it('routes to Home when authenticated and onboarded', () => {
    expect(resolveInitialRoute({ isAuthenticated: true, hasCompletedOnboarding: true })).toBe('/(app)/home');
  });
});

describe('resolveAuthGateRedirect', () => {
  it('require-auth redirects to Welcome when not authenticated', () => {
    expect(resolveAuthGateRedirect('require-auth', { isAuthenticated: false, hasCompletedOnboarding: true })).toBe(
      '/(auth)/welcome'
    );
  });

  it('require-auth allows access when authenticated', () => {
    expect(
      resolveAuthGateRedirect('require-auth', { isAuthenticated: true, hasCompletedOnboarding: true })
    ).toBeNull();
  });

  it('require-guest redirects an authenticated user to onboarding or home', () => {
    expect(resolveAuthGateRedirect('require-guest', { isAuthenticated: true, hasCompletedOnboarding: false })).toBe(
      '/(onboarding)/usage-type'
    );
    expect(resolveAuthGateRedirect('require-guest', { isAuthenticated: true, hasCompletedOnboarding: true })).toBe(
      '/(app)/home'
    );
  });

  it('require-guest allows access when not authenticated', () => {
    expect(
      resolveAuthGateRedirect('require-guest', { isAuthenticated: false, hasCompletedOnboarding: false })
    ).toBeNull();
  });
});
