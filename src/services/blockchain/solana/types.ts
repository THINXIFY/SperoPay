export type SolanaEnvironment = 'devnet' | 'mainnet-beta';

// A single USDC transfer extracted from a transaction's token balance diffs.
// `destinationOwner` is the wallet that ultimately controls the receiving
// token account, resolved from the parsed account keys where possible —
// this is what payment matching compares against the merchant's configured
// wallet address, not the token account address itself.
export interface ParsedTokenTransfer {
  mint: string;
  destinationTokenAccount: string;
  destinationOwner: string | null;
  amountBaseUnits: bigint;
}

export interface ParsedPaymentTransaction {
  signature: string;
  succeeded: boolean;
  slot: number;
  blockTime: number | null;
  transfers: ParsedTokenTransfer[];
}

export type ConfirmationLevel = 'processed' | 'confirmed' | 'finalized';

export interface ExpectedPayment {
  network: SolanaEnvironment;
  mint: string;
  destinationWallet: string;
  /**
   * Full-payment-only requests (the default, and every request that
   * existed before Phase 4C): the transfer must match this exactly.
   * Ignored when minAmountBaseUnits/maxAmountBaseUnits are both set.
   */
  amountBaseUnits: bigint;
  /**
   * Set together, only for a partial-payment-enabled request: any transfer
   * whose amount falls within [min, max] (inclusive) is accepted instead
   * of requiring an exact match against amountBaseUnits. `max` is always
   * the request's current remaining balance — this is also what prevents
   * crediting a transfer that would overpay the request (see
   * paymentVerifier.ts). `min` is the required deposit's base units for a
   * request's first payment, or 1n (any nonzero amount) once at least one
   * payment has already been credited.
   */
  minAmountBaseUnits?: bigint;
  maxAmountBaseUnits?: bigint;
  /** Payment requests expire — a transaction confirmed after this instant does not count. */
  notAfter: Date | null;
}

export type PaymentVerificationFailureReason =
  | 'transaction_not_found'
  | 'transaction_failed'
  | 'wrong_mint'
  | 'wrong_destination'
  | 'wrong_amount'
  | 'insufficient_confirmation'
  | 'expired'
  | 'already_credited'
  | 'rpc_unavailable';

export type PaymentVerificationResult =
  | { valid: true; signature: string; amountBaseUnits: bigint; blockTime: number | null }
  | { valid: false; reason: PaymentVerificationFailureReason };
