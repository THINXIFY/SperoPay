import {
  ASSET_REGISTRY,
  SUPPORTED_ASSETS,
  DEFAULT_ASSET,
  isSupportedAsset,
  getAssetConfig,
  getAssetMint,
  getAssetDecimals,
  isKnownAssetMint,
  getAssetByMint,
} from '../assets';

// Every address here is verified against Circle's official contract-address
// documentation (developers.circle.com/stablecoins/usdc-contract-addresses
// and .../eurc-contract-addresses) AND independently cross-checked live via
// Solana RPC getAccountInfo on both devnet and mainnet-beta -- see
// src/config/assets.ts's own header comment. These tests lock in the exact
// values, so an accidental edit to the registry fails loudly.
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const MAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const EURC_MINT = 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr';

describe('SUPPORTED_ASSETS / DEFAULT_ASSET', () => {
  it('supports exactly USDC and EURC, in that order, USDC first as the default', () => {
    expect(SUPPORTED_ASSETS).toEqual(['USDC', 'EURC']);
    expect(DEFAULT_ASSET).toBe('USDC');
  });
});

describe('ASSET_REGISTRY', () => {
  it('has the exact, Circle-verified USDC mint addresses and 6 decimals', () => {
    expect(ASSET_REGISTRY.USDC).toEqual({
      symbol: 'USDC',
      name: 'USD Coin',
      network: 'Solana',
      decimals: 6,
      mints: { devnet: DEVNET_USDC_MINT, 'mainnet-beta': MAINNET_USDC_MINT },
    });
  });

  it('has the exact, Circle-verified EURC mint address (same on both networks) and 6 decimals', () => {
    expect(ASSET_REGISTRY.EURC).toEqual({
      symbol: 'EURC',
      name: 'Euro Coin',
      network: 'Solana',
      decimals: 6,
      mints: { devnet: EURC_MINT, 'mainnet-beta': EURC_MINT },
    });
  });
});

describe('isSupportedAsset', () => {
  it('accepts USDC and EURC', () => {
    expect(isSupportedAsset('USDC')).toBe(true);
    expect(isSupportedAsset('EURC')).toBe(true);
  });

  it('rejects anything else, including similar-looking or arbitrary strings', () => {
    expect(isSupportedAsset('USDT')).toBe(false);
    expect(isSupportedAsset('SOL')).toBe(false);
    expect(isSupportedAsset('usdc')).toBe(false);
    expect(isSupportedAsset('')).toBe(false);
    expect(isSupportedAsset(null)).toBe(false);
    expect(isSupportedAsset(undefined)).toBe(false);
    expect(isSupportedAsset(123)).toBe(false);
  });
});

describe('getAssetConfig / getAssetMint / getAssetDecimals', () => {
  it('resolves the correct mint per asset and network', () => {
    expect(getAssetMint('USDC', 'devnet')).toBe(DEVNET_USDC_MINT);
    expect(getAssetMint('USDC', 'mainnet-beta')).toBe(MAINNET_USDC_MINT);
    expect(getAssetMint('EURC', 'devnet')).toBe(EURC_MINT);
    expect(getAssetMint('EURC', 'mainnet-beta')).toBe(EURC_MINT);
  });

  it('returns 6 decimals for both supported assets', () => {
    expect(getAssetDecimals('USDC')).toBe(6);
    expect(getAssetDecimals('EURC')).toBe(6);
  });

  it('getAssetConfig returns the full config object', () => {
    expect(getAssetConfig('EURC').name).toBe('Euro Coin');
  });
});

describe('isKnownAssetMint (the mint-injection allowlist gate)', () => {
  it('accepts every registry mint for its own network', () => {
    expect(isKnownAssetMint(DEVNET_USDC_MINT, 'devnet')).toBe(true);
    expect(isKnownAssetMint(MAINNET_USDC_MINT, 'mainnet-beta')).toBe(true);
    expect(isKnownAssetMint(EURC_MINT, 'devnet')).toBe(true);
    expect(isKnownAssetMint(EURC_MINT, 'mainnet-beta')).toBe(true);
  });

  it('rejects the mainnet USDC mint on devnet (wrong network for that address)', () => {
    expect(isKnownAssetMint(MAINNET_USDC_MINT, 'devnet')).toBe(false);
  });

  it('rejects an arbitrary/unsupported mint address on either network', () => {
    // A real, unrelated Solana mint (wrapped SOL) -- proves this is a real
    // allowlist, not just "any well-formed-looking string".
    expect(isKnownAssetMint('So11111111111111111111111111111111111111112', 'devnet')).toBe(false);
    expect(isKnownAssetMint('So11111111111111111111111111111111111111112', 'mainnet-beta')).toBe(false);
  });
});

describe('getAssetByMint (reverse lookup)', () => {
  it('resolves a known mint back to its asset symbol', () => {
    expect(getAssetByMint(DEVNET_USDC_MINT, 'devnet')).toBe('USDC');
    expect(getAssetByMint(EURC_MINT, 'devnet')).toBe('EURC');
  });

  it('returns null for an unknown mint, never a guess', () => {
    expect(getAssetByMint('So11111111111111111111111111111111111111112', 'devnet')).toBeNull();
  });
});
