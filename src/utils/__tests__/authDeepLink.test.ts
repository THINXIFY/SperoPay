import { getAuthCallbackUrl, AUTH_CALLBACK_URL } from '../authDeepLink';

describe('getAuthCallbackUrl', () => {
  it('returns the app\'s literal native scheme callback URL', () => {
    expect(getAuthCallbackUrl()).toBe('speropay://auth/callback');
  });

  it('matches the AUTH_CALLBACK_URL constant (single source of truth)', () => {
    expect(getAuthCallbackUrl()).toBe(AUTH_CALLBACK_URL);
  });
});
