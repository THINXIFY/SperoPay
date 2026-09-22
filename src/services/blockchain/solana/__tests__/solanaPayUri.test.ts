const ORIGINAL_ENV = process.env;

const RECIPIENT = '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu';
const REFERENCE = 'GsbwXfJraMomNxBcpR5TVQaaB6WcU9v4rTUgHTKfyG3g';
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const MAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const EURC_MINT = 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr';

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

    const url = buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 500, asset: 'USDC' });
    const parsed = new URL(url);

    expect(url.startsWith(`solana:${RECIPIENT}?`)).toBe(true);
    expect(parsed.searchParams.get('amount')).toBe('500');
    expect(parsed.searchParams.get('spl-token')).toBe(DEVNET_USDC_MINT);
    expect(parsed.searchParams.get('reference')).toBe(REFERENCE);
  });

  it('includes label and message when provided, omits them when not', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    const withBoth = new URL(
      buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 10, asset: 'USDC', label: 'Acme Co', message: 'Invoice #1' })
    );
    expect(withBoth.searchParams.get('label')).toBe('Acme Co');
    expect(withBoth.searchParams.get('message')).toBe('Invoice #1');

    const withNeither = new URL(buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 10, asset: 'USDC' }));
    expect(withNeither.searchParams.has('label')).toBe(false);
    expect(withNeither.searchParams.has('message')).toBe(false);
  });

  it('encodes the amount with USDC precision and no floating-point artifacts', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    // A classic float trap: 0.1 + 0.2 style inputs must not leak binary
    // imprecision into the on-chain-facing amount string.
    const url = new URL(buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 19.9, asset: 'USDC' }));
    expect(url.searchParams.get('amount')).toBe('19.9');
  });

  it('uses the devnet USDC mint by default', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    const url = new URL(buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 1, asset: 'USDC' }));
    expect(url.searchParams.get('spl-token')).toBe(DEVNET_USDC_MINT);
  });

  it('uses the mainnet USDC mint only when the network is explicitly mainnet-beta', () => {
    process.env.EXPO_PUBLIC_SOLANA_NETWORK = 'mainnet-beta';
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    const url = new URL(buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 1, asset: 'USDC' }));
    expect(url.searchParams.get('spl-token')).toBe(MAINNET_USDC_MINT);
  });

  // Phase 7: the same builder, asked for the other supported asset, must
  // encode EURC's own mint -- never silently fall back to USDC's.
  it('uses the EURC mint when asset is EURC', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    const url = new URL(buildSolanaPayUrl({ recipient: RECIPIENT, reference: REFERENCE, amount: 1, asset: 'EURC' }));
    expect(url.searchParams.get('spl-token')).toBe(EURC_MINT);
  });

  it('throws (fails safely) for an invalid recipient wallet address', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    expect(() => buildSolanaPayUrl({ recipient: 'not-a-wallet', reference: REFERENCE, amount: 1, asset: 'USDC' })).toThrow();
  });

  it('throws (fails safely) for an invalid reference', () => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    expect(() => buildSolanaPayUrl({ recipient: RECIPIENT, reference: 'not-a-reference', amount: 1, asset: 'USDC' })).toThrow();
  });
});

// Devnet payment-handoff investigation: proves, for a realistic merchant
// wallet + request reference + a range of real-world amounts, that parsing
// the generated URI back out returns EXACTLY the recipient/amount/mint/
// reference that went in -- the round trip a wallet's own Solana Pay parser
// performs. This is what rules Spero's own URI generation in or out as the
// cause of a wallet showing "Cash $0.00" instead of the requested amount.
describe('buildSolanaPayUrl round-trip (devnet USDC payment handoff)', () => {
  const MERCHANT_WALLET = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  const REQUEST_REFERENCE = 'CvbEqFwJmuf1sMbLPFT1UprKffDWo1dTgxb8P5UzoXtT';

  it.each([1, 0.5, 2.75, 100])('amount=%s round-trips exactly through the parsed URI', (amount) => {
    delete process.env.EXPO_PUBLIC_SOLANA_NETWORK;
    const { buildSolanaPayUrl } = require('../solanaPayUri');

    const uri = buildSolanaPayUrl({ recipient: MERCHANT_WALLET, reference: REQUEST_REFERENCE, amount, asset: 'USDC' });

    // Never a bare "solana:<recipient>" with the query string dropped --
    // the exact failure mode that would produce a wallet's blank/zero
    // "Cash" fallback instead of the requested USDC amount.
    expect(uri.startsWith(`solana:${MERCHANT_WALLET}?`)).toBe(true);

    const parsed = new URL(uri);
    expect(parsed.searchParams.get('amount')).toBe(String(amount));
    expect(parsed.searchParams.get('spl-token')).toBe(DEVNET_USDC_MINT);
    expect(parsed.searchParams.get('reference')).toBe(REQUEST_REFERENCE);
  });
});
