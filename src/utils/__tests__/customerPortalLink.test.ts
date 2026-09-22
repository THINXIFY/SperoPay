const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('getCustomerPortalUrl', () => {
  it('builds the canonical portal URL from the portal token', () => {
    delete process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL;
    const { getCustomerPortalUrl } = require('../customerPortalLink');
    expect(getCustomerPortalUrl('abc-123')).toBe('https://pay.speropay.app/c/abc-123');
  });

  it('uses EXPO_PUBLIC_CHECKOUT_BASE_URL when set -- the same variable getPublicPaymentUrl reads', () => {
    process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL = 'https://checkout.example.com';
    const { getCustomerPortalUrl } = require('../customerPortalLink');
    expect(getCustomerPortalUrl('abc-123')).toBe('https://checkout.example.com/c/abc-123');
  });

  it('strips a trailing slash from the configured base URL', () => {
    process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL = 'https://checkout.example.com/';
    const { getCustomerPortalUrl } = require('../customerPortalLink');
    expect(getCustomerPortalUrl('abc-123')).toBe('https://checkout.example.com/c/abc-123');
  });
});
