const ORIGINAL_ENV = process.env;
const SIGNATURE = '5x7z9vQKzWn3q8mR2pL6tYcV4jH1sB7fN0xE8dA3wU2kM9nP6rT4gS1vC5bZ7yJ3';

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('buildExplorerTransactionUrl', () => {
  it('builds a devnet URL by default (no EXPO_PUBLIC_SOLANA_NETWORK set)', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildExplorerTransactionUrl } = require('../explorerUrl');

    const url = buildExplorerTransactionUrl(SIGNATURE);
    expect(url).toBe(`https://explorer.solana.com/tx/${SIGNATURE}?cluster=devnet`);
  });

  it('builds a mainnet-beta URL when the app is explicitly configured for mainnet', () => {
    process.env.EXPO_PUBLIC_SOLANA_NETWORK = 'mainnet-beta';
    const { buildExplorerTransactionUrl } = require('../explorerUrl');

    const url = buildExplorerTransactionUrl(SIGNATURE);
    expect(url).toBe(`https://explorer.solana.com/tx/${SIGNATURE}?cluster=mainnet-beta`);
  });

  it('honors an explicitly passed network over the app default, for testing', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildExplorerTransactionUrl } = require('../explorerUrl');

    expect(buildExplorerTransactionUrl(SIGNATURE, 'mainnet-beta')).toContain('cluster=mainnet-beta');
  });

  it('includes the exact transaction signature in the path, never a truncated/re-derived one', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildExplorerTransactionUrl } = require('../explorerUrl');

    const url = buildExplorerTransactionUrl(SIGNATURE);
    expect(url.startsWith(`https://explorer.solana.com/tx/${SIGNATURE}`)).toBe(true);
  });
});
