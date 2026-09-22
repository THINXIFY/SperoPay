import { getSolanaEnvironment } from './config';
import type { SolanaEnvironment } from './types';

// The one place a Solana Explorer link is built -- every screen that wants
// "View on Solana Explorer" calls this rather than constructing the URL
// itself, so the cluster is always derived from the app's real network
// config (never hardcoded to Devnet) and every explorer link looks the
// same. `network` defaults to getSolanaEnvironment() (the same client-side
// config solanaPayUri.ts and every other Solana-facing screen already
// trusts) but can be passed explicitly for testing.
export function buildExplorerTransactionUrl(
  signature: string,
  network: SolanaEnvironment = getSolanaEnvironment()
): string {
  const params = new URLSearchParams({ cluster: network });
  return `https://explorer.solana.com/tx/${signature}?${params.toString()}`;
}
