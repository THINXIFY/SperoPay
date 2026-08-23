const ORIGINAL_ENV = process.env;

const RECIPIENT = '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu';
const REFERENCE = 'GsbwXfJraMomNxBcpR5TVQaaB6WcU9v4rTUgHTKfyG3g';
const DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('buildSolanaPayUrl', () => {
  it('builds a standard solana: transfer-request URI with recipient, amount, mint, and reference', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    const url = buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 500 });
    const parsed = new URL(url);

    expect(url.startsWith(`solana:${RECIPIENT}?`)).toBe(true);
    expect(parsed.searchParams.get('amount')).toBe('500');
    expect(parsed.searchParams.get('spl-token')).toBe(DEVNET_MINT);
    expect(parsed.searchParams.get('reference')).toBe(REFERENCE);
  });

  it('includes label and message when provided, omits them when not', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    const withBoth = new URL(
      buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 10, label: 'Acme Co', message: 'Invoice #1' })
    );
    expect(withBoth.searchParams.get('label')).toBe('Acme Co');
    expect(withBoth.searchParams.get('message')).toBe('Invoice #1');

    const withNeither = new URL(buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 10 }));
    expect(withNeither.searchParams.has('label')).toBe(false);
    expect(withNeither.searchParams.has('message')).toBe(false);
  });

  it('encodes the amount with USDC precision and no floating-point artifacts', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    // A classic float trap: 0.1 + 0.2 style inputs must not leak binary
    // imprecision into the on-chain-facing amount string.
    const url = new URL(buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 19.9 }));
    expect(url.searchParams.get('amount')).toBe('19.9');
  });

  it('uses the devnet USDC mint by default', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    const url = new URL(buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 1 }));
    expect(url.searchParams.get('spl-token')).toBe(DEVNET_MINT);
  });

  it('uses the mainnet USDC mint only when the network is explicitly mainnet-beta', () => {
    process.env.EXPO_PUBLIC_SOLANA_NETWORK = 'mainnet-beta';
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    const url = new URL(buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 1 }));
    expect(url.searchParams.get('spl-token')).toBe(MAINNET_MINT);
  });

  it('throws (fails safely) for an invalid recipient wallet address', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    expect(() => buildSolanaPayUrl({ recipient: 'not-a-wallet', reference: REFERENCE, amount: 1 })).toThrow();
  });

  it('throws (fails safely) for an invalid reference', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    expect(() => buildSolanaPayUrl({ recipient: RECIPIENT, reference: 'not-a-reference', amount: 1 })).toThrow();
  });
});
