import type { SolanaSignatureDiscoveryProvider } from './client.ts';
import { matchPayment, withRetry, type PaymentMatcherDeps } from './paymentMatcher.ts';
import type { ExpectedPayment, PaymentVerificationResult } from './types.ts';

const DEFAULT_CANDIDATE_LIMIT = 10;

export type PaymentDiscoveryOutcome =
  | { kind: 'paid'; result: Extract<PaymentVerificationResult, { valid: true }> }
  | { kind: 'confirming' }
  | { kind: 'no_match' }
  | { kind: 'rpc_unavailable' };

export interface FindPaymentDeps extends PaymentMatcherDeps {
  discoveryProvider: SolanaSignatureDiscoveryProvider;
}

// The one new piece of logic Phase 3D actually adds: given a Solana Pay
// reference (not a signature — nothing has told Spero a signature yet),
// find which candidate transaction(s) touched that reference account and
// run each through the existing, unchanged matchPayment() until one is
// valid. This is deliberately NOT a second verifier: every actual
// correctness check (mint, destination, amount, confirmation, expiry,
// already-credited) still happens exclusively inside matchPayment ->
// verifyPayment, which this function never reimplements or bypasses.
//
// A candidate whose only problem is insufficient_confirmation means the
// real payment transaction was found, just not settled enough yet — that
// specific failure reason is what distinguishes "move this request to
// confirming" from "nothing relevant here yet" (wrong amount/mint/wallet
// on some unrelated transaction that happened to reference this account,
// which must never move the request out of pending).
export async function findPaymentForRequest(
  reference: string,
  expected: ExpectedPayment,
  deps: FindPaymentDeps,
  limit: number = DEFAULT_CANDIDATE_LIMIT
): Promise<PaymentDiscoveryOutcome> {
  let signatures: string[];
  try {
    signatures = await withRetry(() => deps.discoveryProvider.getSignaturesForAddress(reference, limit));
  } catch {
    return { kind: 'rpc_unavailable' };
  }

  let sawInsufficientConfirmation = false;

  for (const signature of signatures) {
    const result = await matchPayment(signature, expected, deps);
    if (result.valid) {
      return { kind: 'paid', result };
    }
    if (result.reason === 'insufficient_confirmation') {
      sawInsufficientConfirmation = true;
    }
  }

  return sawInsufficientConfirmation ? { kind: 'confirming' } : { kind: 'no_match' };
}
