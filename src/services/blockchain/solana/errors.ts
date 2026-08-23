// Structured, user-safe error codes for the blockchain layer. Never surface
// a raw RPC/provider error message to the UI (spec section 26) — provider
// errors can be verbose, inconsistent between vendors, or leak
// implementation details; callers should map these codes to calm copy
// instead, the same way getDataErrorMessage does for Supabase errors.
export type BlockchainErrorCode =
  | 'invalid_wallet_address'
  | 'transaction_not_found'
  | 'transaction_failed'
  | 'wrong_token'
  | 'wrong_destination'
  | 'wrong_amount'
  | 'insufficient_confirmation'
  | 'already_credited'
  | 'expired'
  | 'rpc_unavailable'
  | 'rpc_timeout';

export class BlockchainError extends Error {
  readonly code: BlockchainErrorCode;

  constructor(code: BlockchainErrorCode, message: string) {
    super(message);
    this.name = 'BlockchainError';
    this.code = code;
  }
}
