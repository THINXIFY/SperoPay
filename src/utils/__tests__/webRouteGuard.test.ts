import { isWebPubliclyAllowedPath } from '../webRouteGuard';

describe('isWebPubliclyAllowedPath', () => {
  it('allows a public checkout link with a token', () => {
    expect(isWebPubliclyAllowedPath('/p/abc-123')).toBe(true);
  });

  it('allows a client portal link with a token', () => {
    expect(isWebPubliclyAllowedPath('/c/abc-123')).toBe(true);
  });

  it('allows the auth callback screen (native auth flow defense in depth)', () => {
    expect(isWebPubliclyAllowedPath('/auth/callback')).toBe(true);
  });

  it('allows the reset-password screen (password recovery must always be completable)', () => {
    expect(isWebPubliclyAllowedPath('/reset-password')).toBe(true);
  });

  it('blocks the root/splash route', () => {
    expect(isWebPubliclyAllowedPath('/')).toBe(false);
  });

  it('blocks every merchant/native-app route by default (allowlist, not a denylist)', () => {
    expect(isWebPubliclyAllowedPath('/welcome')).toBe(false);
    expect(isWebPubliclyAllowedPath('/login')).toBe(false);
    expect(isWebPubliclyAllowedPath('/sign-up')).toBe(false);
    expect(isWebPubliclyAllowedPath('/forgot-password')).toBe(false);
    expect(isWebPubliclyAllowedPath('/usage-type')).toBe(false);
    expect(isWebPubliclyAllowedPath('/home')).toBe(false);
    expect(isWebPubliclyAllowedPath('/requests')).toBe(false);
    expect(isWebPubliclyAllowedPath('/requests/req-1')).toBe(false);
    expect(isWebPubliclyAllowedPath('/customers')).toBe(false);
    expect(isWebPubliclyAllowedPath('/profile')).toBe(false);
    expect(isWebPubliclyAllowedPath('/profile/templates')).toBe(false);
    expect(isWebPubliclyAllowedPath('/analytics')).toBe(false);
    expect(isWebPubliclyAllowedPath('/recurring')).toBe(false);
    expect(isWebPubliclyAllowedPath('/request/amount')).toBe(false);
  });

  it('blocks the legacy mock-payment demo flow too, not just the real merchant app', () => {
    expect(isWebPubliclyAllowedPath('/pay/some-request-id')).toBe(false);
    expect(isWebPubliclyAllowedPath('/pay/demo')).toBe(false);
  });

  it('does not treat an unrelated path merely starting with the same letter as allowed', () => {
    expect(isWebPubliclyAllowedPath('/profile')).toBe(false); // starts with "p" but is not "/p/"
    expect(isWebPubliclyAllowedPath('/customers')).toBe(false); // starts with "c" but is not "/c/"
  });
});
