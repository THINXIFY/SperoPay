// Structured, UI-safe error codes for the public checkout lookup. Never
// surface a raw Supabase/PostgREST error to an anonymous payer — same
// discipline as src/services/blockchain/solana/errors.ts.
export type PublicCheckoutErrorCode = 'invalid_token' | 'not_found' | 'network_error';

export class PublicCheckoutError extends Error {
  readonly code: PublicCheckoutErrorCode;

  constructor(code: PublicCheckoutErrorCode, message: string) {
    super(message);
    this.name = 'PublicCheckoutError';
    this.code = code;
  }
}
