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
// itself retry (up to RPC_MAX_ATTEMPTS attempts of RPC_TIMEOUT_MS each,
// plus backoff -- around 30s worst case for a *single* candidate), so a
// pathological candidate list (many signatures that all time out) could
// otherwise take minutes for one verification attempt -- far past a
// payer's patience and a real risk of hitting an Edge Function platform
// timeout mid-request. This is enforced as a genuine deadline via
// Promise.race below (see findPaymentForRequest), not merely checked
// between steps -- a between-steps check alone cannot cut off a single
// slow in-flight call, which is exactly the scenario this budget exists
// to bound.
const OVERALL_BUDGET_MS = 20_000;

export type PaymentDiscoveryOutcome =
  | { kind: 'paid'; result: Extract<PaymentVerificationResult, { valid: true }> }
  | { kind: 'confirming' }
  | { kind: 'no_match'; lastReason?: PaymentVerificationFailureReason }
  | { kind: 'rpc_unavailable' };

export interface FindPaymentDeps extends PaymentMatcherDeps {
  discoveryProvider: SolanaSignatureDiscoveryProvider;
}

interface DiscoveryProgress {
  sawInsufficientConfirmation: boolean;
  lastReason: PaymentVerificationFailureReason | undefined;
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
//
// Races the actual discovery work against a hard OVERALL_BUDGET_MS
// deadline. Racing (not just checking Date.now() between steps) is what
// makes this a genuine ceiling: a single slow matchPayment call can't
// blow past it just because nothing checks the clock again until that
// call resolves. The deadline branch still reports `confirming` if
// progressToDate already saw it -- a slow-but-real payment must not be
// reported as "nothing found" just because verification hasn't finished
// double-checking every candidate yet. The losing side of the race (if
// discovery is still running when the deadline wins) is simply abandoned;
// it performs no writes itself, so there is nothing unsafe about it
// continuing in the background for whatever the runtime allows.
export async function findPaymentForRequest(
  reference: string,
  expected: ExpectedPayment,
  deps: FindPaymentDeps,
  limit: number = DEFAULT_CANDIDATE_LIMIT
): Promise<PaymentDiscoveryOutcome> {
  const progress: DiscoveryProgress = { sawInsufficientConfirmation: false, lastReason: undefined };

  return Promise.race([
    runDiscovery(reference, expected, deps, limit, progress),
    new Promise<PaymentDiscoveryOutcome>((resolve) => {
      setTimeout(() => resolve(progressToOutcome(progress)), OVERALL_BUDGET_MS);
    }),
  ]);
}

function progressToOutcome(progress: DiscoveryProgress): PaymentDiscoveryOutcome {
  return progress.sawInsufficientConfirmation
    ? { kind: 'confirming' }
    : { kind: 'no_match', lastReason: progress.lastReason };
}

async function runDiscovery(
  reference: string,
  expected: ExpectedPayment,
  deps: FindPaymentDeps,
  limit: number,
  progress: DiscoveryProgress
): Promise<PaymentDiscoveryOutcome> {
  let before: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    let signatures: string[];
    try {
      signatures = await withRetry(() => deps.discoveryProvider.getSignaturesForAddress(reference, limit, before));
    } catch {
      return { kind: 'rpc_unavailable' };
    }

    if (signatures.length === 0) break;

    for (const signature of signatures) {
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
      progress.lastReason = result.reason;
      if (result.reason === 'insufficient_confirmation') {
        progress.sawInsufficientConfirmation = true;
      }
    }

    if (signatures.length < limit) break; // reached the real end of this address's history
    before = signatures[signatures.length - 1];
  }

  return progressToOutcome(progress);
}
