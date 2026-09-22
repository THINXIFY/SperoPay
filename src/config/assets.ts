// '.ts'-suffixed relative import -- this module is reachable from the
// verify-payment Edge Function's Deno dependency graph (via
// paymentAccounting.ts), which requires an explicit extension on every
// relative import; see paymentAccounting.ts's own header comment.
import type { SolanaEnvironment } from '../services/blockchain/solana/types.ts';

// Phase 7 -- the single authoritative list of payment assets Spero
// supports. Every screen, store, edge function, and verification check
// must read asset identity (symbol, decimals, mint) from here -- nowhere
// else in the codebase should hardcode a mint address or assume a fixed
// decimals count. Adding a third asset later means adding one entry here,
// not hunting down every call site that assumed exactly two.
//
// Both networks/environments for both assets have been verified against
// Circle's official contract-address documentation
// (https://developers.circle.com/stablecoins/usdc-contract-addresses and
// .../eurc-contract-addresses) AND independently cross-checked live via
// Solana RPC `getAccountInfo` on both devnet and mainnet-beta -- each
// address below is a real, initialized SPL Token-Program mint with the
// decimals listed. EURC deliberately uses the SAME mint address on both
// devnet and mainnet-beta (confirmed on-chain on both clusters) -- unlike
// USDC, which has two genuinely different mint addresses per network.
// Never assume the two networks share an address for a future asset
// without verifying independently the same way.
export type AssetSymbol = 'USDC' | 'EURC';

export interface AssetConfig {
  symbol: AssetSymbol;
  name: string;
  network: 'Solana';
  decimals: number;
  mints: Record<SolanaEnvironment, string>;
}

export const ASSET_REGISTRY: Record<AssetSymbol, AssetConfig> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    network: 'Solana',
    decimals: 6,
    mints: {
      devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
  },
  EURC: {
    symbol: 'EURC',
    name: 'Euro Coin',
    network: 'Solana',
    decimals: 6,
    mints: {
      devnet: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
      'mainnet-beta': 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
    },
  },
};

// Order here is the canonical display order everywhere a selector lists
// both assets (Smart Request, Business Settings, Templates, Recurring
// Plans) -- USDC first, matching "default remains USDC for existing
// users" (spec section 3).
export const SUPPORTED_ASSETS: AssetSymbol[] = ['USDC', 'EURC'];

export const DEFAULT_ASSET: AssetSymbol = 'USDC';

export function isSupportedAsset(value: unknown): value is AssetSymbol {
  return typeof value === 'string' && (SUPPORTED_ASSETS as string[]).includes(value);
}

export function getAssetConfig(asset: AssetSymbol): AssetConfig {
  return ASSET_REGISTRY[asset];
}

export function getAssetMint(asset: AssetSymbol, environment: SolanaEnvironment): string {
  return ASSET_REGISTRY[asset].mints[environment];
}

export function getAssetDecimals(asset: AssetSymbol): number {
  return ASSET_REGISTRY[asset].decimals;
}

// The allowlist gate spec section 18 requires: a mint is only ever
// "valid" for a network if it's exactly one of this registry's own
// configured addresses for that network -- never an arbitrary
// caller-supplied or on-chain-derived value. Used by paymentMatcher.ts's
// construction sanity check.
export function isKnownAssetMint(mint: string, environment: SolanaEnvironment): boolean {
  return SUPPORTED_ASSETS.some((asset) => ASSET_REGISTRY[asset].mints[environment] === mint);
}

// Reverse lookup -- given a mint that appeared in an on-chain transfer,
// which supported asset (if any) does it correspond to on this network?
// Returns null for any mint outside the registry (an unsupported/unknown
// token), never a guess.
export function getAssetByMint(mint: string, environment: SolanaEnvironment): AssetSymbol | null {
  return SUPPORTED_ASSETS.find((asset) => ASSET_REGISTRY[asset].mints[environment] === mint) ?? null;
}
