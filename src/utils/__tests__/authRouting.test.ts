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

  it('routes to Reset Password when a password recovery session is active, regardless of other state', () => {
    expect(
      resolveInitialRoute({ isAuthenticated: true, hasCompletedOnboarding: true, isPasswordRecovery: true })
    ).toBe('/(auth)/reset-password');
    expect(
      resolveInitialRoute({ isAuthenticated: false, hasCompletedOnboarding: false, isPasswordRecovery: true })
    ).toBe('/(auth)/reset-password');
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

  it('require-guest allows a password-recovery session to stay put', () => {
    expect(
      resolveAuthGateRedirect('require-guest', {
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        isPasswordRecovery: true,
      })
    ).toBeNull();
  });

  it('require-auth redirects a password-recovery session to Reset Password', () => {
    expect(
      resolveAuthGateRedirect('require-auth', {
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        isPasswordRecovery: true,
      })
    ).toBe('/(auth)/reset-password');
  });
});
