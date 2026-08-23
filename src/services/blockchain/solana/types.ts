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
  usdcMint: string;
  destinationWallet: string;
  amountBaseUnits: bigint;
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
