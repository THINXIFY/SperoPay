const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('getCheckoutBaseUrl', () => {
  it('defaults to the production checkout domain when unset', () => {
    delete process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL;
    const { getCheckoutBaseUrl } = require('../checkoutBaseUrl');
    expect(getCheckoutBaseUrl()).toBe('https://pay.speropay.app');
  });

  it('uses EXPO_PUBLIC_CHECKOUT_BASE_URL when set', () => {
    process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL = 'https://checkout.example.com';
    const { getCheckoutBaseUrl } = require('../checkoutBaseUrl');
    expect(getCheckoutBaseUrl()).toBe('https://checkout.example.com');
  });

  it('strips a trailing slash from the configured base URL', () => {
    process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL = 'https://checkout.example.com/';
    const { getCheckoutBaseUrl } = require('../checkoutBaseUrl');
    expect(getCheckoutBaseUrl()).toBe('https://checkout.example.com');
  });
});

describe('isCheckoutBaseUrlConfigured', () => {
  it('is false when EXPO_PUBLIC_CHECKOUT_BASE_URL is unset (the aspirational default domain is not live)', () => {
    delete process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL;
    const { isCheckoutBaseUrlConfigured } = require('../checkoutBaseUrl');
    expect(isCheckoutBaseUrlConfigured()).toBe(false);
  });

  it('is true once EXPO_PUBLIC_CHECKOUT_BASE_URL is set', () => {
    process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL = 'https://checkout.example.com';
    const { isCheckoutBaseUrlConfigured } = require('../checkoutBaseUrl');
    expect(isCheckoutBaseUrlConfigured()).toBe(true);
  });
});
