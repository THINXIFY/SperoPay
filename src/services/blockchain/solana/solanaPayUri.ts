import { getSolanaEnvironment } from './config';
import { getUsdcConfig } from './usdc';
import { isValidSolanaAddress } from './walletValidation';
import { fromBaseUnits, toBaseUnits } from './amount';

// Standard Solana Pay "transfer request" URI:
// solana:<recipient>?amount=<amount>&spl-token=<mint>&reference=<reference>&label=<label>&message=<message>
// https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#transfer-request
// This is the one place in the app that builds this URI -- deliberately
// pure/no I/O, so it can be unit tested without a network or a real wallet.
export interface SolanaPayRequestParams {
  recipient: string;
  reference: string;
  amount: number;
  label?: string;
  message?: string;
}

export function buildSolanaPayUrl(params: SolanaPayRequestParams): string {
  if (!isValidSolanaAddress(params.recipient)) {
    throw new Error(`buildSolanaPayUrl: invalid recipient wallet address "${params.recipient}"`);
  }
  if (!isValidSolanaAddress(params.reference)) {
    throw new Error(`buildSolanaPayUrl: invalid reference "${params.reference}"`);
  }

  const network = getSolanaEnvironment();
  const { mint, decimals } = getUsdcConfig(network);

  // Round-trip through base units so the encoded amount always has exactly
  // the token's decimal precision and never a floating-point artifact
  // (spec section 2's "correct USDC amount" -- reuses the same bigint
  // conversion payment verification will use, rather than inventing a
  // second, looser way to format an amount).
  const normalizedAmount = fromBaseUnits(toBaseUnits(params.amount, decimals), decimals);

  const search = new URLSearchParams();
  search.set('amount', normalizedAmount);
  search.set('spl-token', mint);
  search.set('reference', params.reference);
  if (params.label) search.set('label', params.label);
  if (params.message) search.set('message', params.message);

  return `solana:${params.recipient}?${search.toString()}`;
}
