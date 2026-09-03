import type { SolanaSignatureDiscoveryProvider } from './client.ts';
import { matchPayment, withRetry, type PaymentMatcherDeps } from './paymentMatcher.ts';
import type { ExpectedPayment, PaymentVerificationFailureReason, PaymentVerificationResult } from './types.ts';

const DEFAULT_CANDIDATE_LIMIT = 10;
// Bounds total work per call to MAX_PAGES * limit signatures -- never
// unbounded (spec: no endless retry loops) -- while still meaningfully
// raising the cost of a griefing attack that spams cheap transactions
// referencing this account *after* the real payment, trying to push it
// out of a single most-recent-N page. Paging stops early once a page
// comes back shorter than `limit` (the real end of this address's
// on-chain history), so a quiet reference costs exactly one RPC call.
const MAX_PAGES = 3;

// A wall-clock ceiling on top of MAX_PAGES: each matchPayment call can
// itself retry (up to RPC_MAX_ATTEMPTS * RPC_TIMEOUT_MS), so a pathological
// candidate list (many signatures that all time out) could otherwise take
// minutes for one verification attempt -- far past a payer's patience and
// close to an Edge Function platform timeout. Checked between pages and
// between candidates, so a slow run stops promptly at a safe boundary
// (never mid-matchPayment-call) rather than exactly at this instant.
const OVERALL_BUDGET_MS = 20_000;

export type PaymentDiscoveryOutcome =
  | { kind: 'paid'; result: Extract<PaymentVerificationResult, { valid: true }> }
  | { kind: 'confirming' }
  | { kind: 'no_match'; lastReason?: PaymentVerificationFailureReason }
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
  const startedAt = Date.now();
  let sawInsufficientConfirmation = false;
  let lastReason: PaymentVerificationFailureReason | undefined;
  let before: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() - startedAt > OVERALL_BUDGET_MS) break;

    let signatures: string[];
    try {
      signatures = await withRetry(() => deps.discoveryProvider.getSignaturesForAddress(reference, limit, before));
    } catch {
      return { kind: 'rpc_unavailable' };
    }

    if (signatures.length === 0) break;

    for (const signature of signatures) {
      if (Date.now() - startedAt > OVERALL_BUDGET_MS) break;

      let result: PaymentVerificationResult;
      try {
        result = await matchPayment(signature, expected, deps);
      } catch {
        // One malformed/unexpected candidate must never hide a good one
        // (or a still-confirming one) elsewhere in the list -- treat it as
        // "not this one" and keep checking the rest.
        continue;
      }
      if (result.valid) {
        return { kind: 'paid', result };
      }
      lastReason = result.reason;
      if (result.reason === 'insufficient_confirmation') {
        sawInsufficientConfirmation = true;
      }
    }

    if (signatures.length < limit) break; // reached the real end of this address's history
    before = signatures[signatures.length - 1];
  }

  return sawInsufficientConfirmation ? { kind: 'confirming' } : { kind: 'no_match', lastReason };
}
