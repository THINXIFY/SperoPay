// Imported directly from their own files, not the '../types' barrel --
// this module is reachable from the verify-payment Edge Function's
// dependency graph (Deno), and Deno's local-module resolution requires a
// full, explicit relative path (filename + extension) for every hop, with
// no Node/Metro-style "resolve a bare directory to its index" behavior.
// '../types' would need to become '../types/index.ts' AND every file that
// barrel re-exports would need its own imports made Deno-safe too --
// importing straight from '../types/payment.ts' and '../types/recurring.ts'
// (the only two files these three names actually live in) is the smaller,
// equally-correct fix. Safe for the RN/Metro app too: '.ts'-suffixed
// relative imports are already the standing convention in
// src/services/blockchain/solana/*.ts, consumed by both this app and Deno
// today without issue (see tsconfig's allowImportingTsExtensions).
import type { PaymentRequest, Transaction } from '../types/payment.ts';
import type { DepositType } from '../types/recurring.ts';
import { toBaseUnits, fromBaseUnits } from '../services/blockchain/solana/amount.ts';
import { getAssetDecimals, DEFAULT_ASSET, type AssetSymbol } from '../config/assets.ts';

export interface PaymentAccounting {
  totalAmount: number;
  verifiedPaidAmount: number;
  remainingAmount: number;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
}

// The one place "how much of this request has really been paid" is
// computed -- always by summing real transaction rows in exact bigint base
// units, never by trusting a client-supplied total or doing float
// arithmetic on decimal amounts (spec: "Do NOT trust totals calculated
// only by the client"). Used identically by Request Detail, invoices,
// receipts, and (via a server-computed equivalent) the public checkout
// page's own RPC.
// Decimals come from the request's OWN asset (src/config/assets.ts), not a
// fixed constant -- a EURC request must be accounted in EURC's decimals,
// never silently borrowed from whichever asset happened to be hardcoded
// before Phase 7. USDC and EURC both happen to use 6 decimals today, but
// this must never be assumed; it's always a registry lookup.
export function computePaymentAccounting(request: PaymentRequest, transactions: Transaction[]): PaymentAccounting {
  const decimals = getAssetDecimals(request.currency);
  const totalBaseUnits = toBaseUnits(request.amount, decimals);
  const paidBaseUnits = transactions
    .filter((t) => t.requestId === request.id)
    .reduce((sum, t) => sum + toBaseUnits(t.amount, decimals), 0n);
  // Clamped, never negative -- an on-chain overpayment (should already be
  // prevented at verification time, see paymentVerifier.ts's range check)
  // must never surface as a negative "remaining" figure.
  const remainingBaseUnits = paidBaseUnits >= totalBaseUnits ? 0n : totalBaseUnits - paidBaseUnits;

  return {
    totalAmount: Number(fromBaseUnits(totalBaseUnits, decimals)),
    verifiedPaidAmount: Number(fromBaseUnits(paidBaseUnits, decimals)),
    remainingAmount: Number(fromBaseUnits(remainingBaseUnits, decimals)),
    isFullyPaid: paidBaseUnits >= totalBaseUnits,
    isPartiallyPaid: paidBaseUnits > 0n && paidBaseUnits < totalBaseUnits,
  };
}

// A fixed deposit is just that value; a percentage deposit is computed in
// exact bigint base units (the percentage itself is rounded to 2 decimal
// places first -- it's a configuration number, not money, so that rounding
// never touches the actual currency arithmetic below it). `currency`
// defaults to DEFAULT_ASSET (USDC) so every pre-Phase-7 call site (and
// every existing test) keeps behaving byte-for-byte identically; callers
// that know the request's real asset should pass it explicitly.
export function computeDepositAmount(
  totalAmount: number,
  depositType: DepositType | undefined,
  depositValue: number | undefined,
  currency: AssetSymbol = DEFAULT_ASSET
): number | undefined {
  if (!depositType || depositValue == null) return undefined;
  if (depositType === 'fixed') return depositValue;

  const decimals = getAssetDecimals(currency);
  const totalBaseUnits = toBaseUnits(totalAmount, decimals);
  const percentageHundredths = BigInt(Math.round(depositValue * 100));
  const depositBaseUnits = (totalBaseUnits * percentageHundredths) / 10_000n;
  return Number(fromBaseUnits(depositBaseUnits, decimals));
}
