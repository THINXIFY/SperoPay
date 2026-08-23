import { getSolanaRpcUrl } from './config';
import { getUsdcConfig } from './usdc';

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
export function assertRealPaymentConfigured(): void {
  if (getPaymentMode() !== 'real') return;

  const rpcUrl = getSolanaRpcUrl();
  if (!rpcUrl) {
    throw new Error('PAYMENT_MODE is "real" but no Solana RPC URL could be resolved.');
  }
  const usdc = getUsdcConfig('mainnet-beta');
  if (!usdc.mint) {
    throw new Error('PAYMENT_MODE is "real" but mainnet USDC configuration is missing.');
  }
}
