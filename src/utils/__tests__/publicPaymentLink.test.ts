const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('getPublicPaymentUrl', () => {
  it('builds the canonical checkout URL from the public token', () => {
    delete process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL;
    const { getPublicPaymentUrl } = require('../publicPaymentLink');
    expect(getPublicPaymentUrl('abc-123')).toBe('https://pay.speropay.app/p/abc-123');
  });

  it('uses EXPO_PUBLIC_CHECKOUT_BASE_URL when set', () => {
    process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL = 'https://checkout.example.com';
    const { getPublicPaymentUrl } = require('../publicPaymentLink');
    expect(getPublicPaymentUrl('abc-123')).toBe('https://checkout.example.com/p/abc-123');
  });

  it('strips a trailing slash from the configured base URL', () => {
    process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL = 'https://checkout.example.com/';
    const { getPublicPaymentUrl } = require('../publicPaymentLink');
    expect(getPublicPaymentUrl('abc-123')).toBe('https://checkout.example.com/p/abc-123');
  });
});
