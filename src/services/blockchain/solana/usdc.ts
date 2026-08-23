import type { SolanaEnvironment } from './types';

interface UsdcNetworkConfig {
  mint: string;
  decimals: number;
}

// Devnet and mainnet USDC are DIFFERENT tokens with different mint
// addresses — never assume they're interchangeable (spec section 8).
// The devnet mint below is Circle's official devnet USDC (the one their
// own devnet faucet issues); verify against Circle's current devnet docs
// before relying on it for real integration testing, since devnet token
// deployments are less permanent than mainnet ones.
const USDC_CONFIG: Record<SolanaEnvironment, UsdcNetworkConfig> = {
  devnet: {
    mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    decimals: 6,
  },
  'mainnet-beta': {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
  },
};

export function getUsdcConfig(network: SolanaEnvironment): UsdcNetworkConfig {
  return USDC_CONFIG[network];
}
