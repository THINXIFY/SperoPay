import { getSolanaEnvironment } from './config';

export type PaymentMode = 'mock' | 'real';

// Nothing reads this yet — no screen is wired to real payments in this
// phase. It exists so Phase 3B+ has a single source of truth to gate on,
// defaulting to 'mock' so an unconfigured build never silently attempts
// real verification.
export function getPaymentMode(): PaymentMode {
  return process.env.EXPO_PUBLIC_PAYMENT_MODE === 'real' ? 'real' : 'mock';
}

// Spec section 25: production must fail loudly, not silently fall back to
// mock, if it's configured for real payments but the configuration is
// incomplete. Call this at startup once a real payment path exists.
//
// The one condition that actually matters here: EXPO_PUBLIC_SOLANA_NETWORK
// defaults to 'devnet' whenever it's unset or anything other than
// 'mainnet-beta' (config.ts's deliberate fail-safe default). That means a
// build with PAYMENT_MODE=real but no explicit network var would silently
// verify payments against free devnet USDC as if they were real money — the
// exact silent-fallback failure mode this function exists to prevent. (The
// RPC URL and USDC mint config, by contrast, always resolve to *something*
// — clusterApiUrl() and the hardcoded mint constants can't be empty — so
// checking those was never actually catching a real misconfiguration.)
export function assertRealPaymentConfigured(): void {
  if (getPaymentMode() !== 'real') return;

  if (getSolanaEnvironment() !== 'mainnet-beta') {
    throw new Error(
      'PAYMENT_MODE is "real" but EXPO_PUBLIC_SOLANA_NETWORK is not "mainnet-beta" — refusing to treat devnet USDC as real payment.'
    );
  }
}
