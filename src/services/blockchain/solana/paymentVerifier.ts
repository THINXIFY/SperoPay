import type { ConfirmationLevel, ExpectedPayment, ParsedPaymentTransaction, PaymentVerificationResult } from './types.ts';

const CONFIRMATION_RANK: Record<ConfirmationLevel, number> = { processed: 0, confirmed: 1, finalized: 2 };

export interface VerifyPaymentParams {
  /** null means the RPC lookup itself found nothing for this signature. */
  tx: ParsedPaymentTransaction | null;
  expected: ExpectedPayment;
  /** null means the signature status couldn't be determined yet. */
  confirmationLevel: ConfirmationLevel | null;
  requiredConfirmationLevel: ConfirmationLevel;
  /** Has this signature already been recorded against some payment request? */
  alreadyCredited: boolean;
}

// The 8 checks from spec section 12. Deliberately pure and dependency-free
// (no RPC calls, no Supabase) — every input is a plain value the caller
// (paymentMatcher.ts, ultimately a server-side boundary) already resolved,
// so this is fully unit-testable with fixtures and has no hidden network
// or config coupling. "Correct network" (spec check 3) is enforced by
// construction, not re-checked here: whichever SolanaRpcProvider fetched
// `tx` was already scoped to one cluster, and a Solana transaction has no
// self-describing "which cluster" field to independently verify against.
export function verifyPayment(params: VerifyPaymentParams): PaymentVerificationResult {
  const { tx, expected, confirmationLevel, requiredConfirmationLevel, alreadyCredited } = params;

  if (!tx) return { valid: false, reason: 'transaction_not_found' };
  if (!tx.succeeded) return { valid: false, reason: 'transaction_failed' };
  if (alreadyCredited) return { valid: false, reason: 'already_credited' };

  if (expected.notAfter) {
    // A missing blockTime must not silently skip the expiry check — that
    // would fail OPEN (an arbitrarily old/unverifiable-timing transaction
    // would satisfy an expired request). Required confirmation is
    // 'confirmed' or better, which always carries a blockTime in practice,
    // so treating "can't verify timing" the same as "too late" is the safe
    // default, not an overreaction.
    if (tx.blockTime == null || tx.blockTime * 1000 > expected.notAfter.getTime()) {
      return { valid: false, reason: 'expired' };
    }
  }

  const mintMatches = tx.transfers.filter((transfer) => transfer.mint === expected.usdcMint);
  if (mintMatches.length === 0) return { valid: false, reason: 'wrong_mint' };

  const destinationMatches = mintMatches.filter(
    (transfer) => transfer.destinationOwner === expected.destinationWallet
  );
  if (destinationMatches.length === 0) return { valid: false, reason: 'wrong_destination' };

  const amountMatch = destinationMatches.find(
    (transfer) => transfer.amountBaseUnits === expected.amountBaseUnits
  );
  if (!amountMatch) return { valid: false, reason: 'wrong_amount' };

  if (!confirmationLevel || CONFIRMATION_RANK[confirmationLevel] < CONFIRMATION_RANK[requiredConfirmationLevel]) {
    return { valid: false, reason: 'insufficient_confirmation' };
  }

  return {
    valid: true,
    signature: tx.signature,
    amountBaseUnits: amountMatch.amountBaseUnits,
    blockTime: tx.blockTime,
  };
}
