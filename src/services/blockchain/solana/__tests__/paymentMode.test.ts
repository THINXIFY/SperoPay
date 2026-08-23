const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('getPaymentMode', () => {
  it('defaults to mock when unset', () => {
    delete process.env.EXPO_PUBLIC_PAYMENT_MODE;
    const { getPaymentMode } = require('../paymentMode');
    expect(getPaymentMode()).toBe('mock');
  });

  it('is real only when explicitly set to "real"', () => {
    process.env.EXPO_PUBLIC_PAYMENT_MODE = 'real';
    const { getPaymentMode } = require('../paymentMode');
    expect(getPaymentMode()).toBe('real');
  });
});

describe('assertRealPaymentConfigured', () => {
  it('does nothing in mock mode regardless of network config', () => {
    delete process.env.EXPO_PUBLIC_PAYMENT_MODE;
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { assertRealPaymentConfigured } = require('../paymentMode');
    expect(() => assertRealPaymentConfigured()).not.toThrow();
  });

  it('throws when real mode is set but the network is not explicitly mainnet-beta', () => {
    process.env.EXPO_PUBLIC_PAYMENT_MODE = 'real';
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { assertRealPaymentConfigured } = require('../paymentMode');
    expect(() => assertRealPaymentConfigured()).toThrow(/mainnet-beta/);
  });

  it('does not throw when real mode is set and the network is explicitly mainnet-beta', () => {
    process.env.EXPO_PUBLIC_PAYMENT_MODE = 'real';
    process.env.EXPO_PUBLIC_SOLANA_NETWORK = 'mainnet-beta';
    const { assertRealPaymentConfigured } = require('../paymentMode');
    expect(() => assertRealPaymentConfigured()).not.toThrow();
  });
});
