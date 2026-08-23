import { clusterApiUrl } from '@solana/web3.js';
import type { SolanaEnvironment } from './types';

// Which cluster the app targets. Defaults to devnet — a production build
// must explicitly opt into mainnet-beta via EXPO_PUBLIC_SOLANA_NETWORK,
// never the other way around, so a misconfigured build fails toward the
// safer (fake-money) environment rather than the dangerous one.
export function getSolanaEnvironment(): SolanaEnvironment {
  const value = process.env.EXPO_PUBLIC_SOLANA_NETWORK;
  return value === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
}

// Reading public blockchain data needs no secret, so a custom endpoint URL
// (e.g. a paid provider's devnet/mainnet endpoint) is safe to expose as
// EXPO_PUBLIC_*. Falls back to Solana's public cluster endpoints, which
// require no signup/API key — see design doc Decision 1 for why this is
// the deliberate default rather than hardwiring a specific paid vendor.
export function getSolanaRpcUrl(): string {
  const override = process.env.EXPO_PUBLIC_SOLANA_RPC_URL;
  if (override) return override;
  return clusterApiUrl(getSolanaEnvironment());
}

// begin_payment_confirmation/complete_payment style flows should treat a
// payment as durably settled only at 'confirmed' or better — 'processed'
// can still be dropped/rolled back by the cluster. See design doc's
// confirmation-rules note and paymentVerifier.ts, which enforces this.
export const REQUIRED_CONFIRMATION_LEVEL = 'confirmed' as const;
