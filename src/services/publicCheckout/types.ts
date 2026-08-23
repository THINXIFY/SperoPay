import type { PaymentRequestStatus } from '../../types';

// Mirrors get_public_payment_request's exact return shape
// (supabase/migrations/0005_phase3a_payment_foundation.sql) — deliberately
// only the fields that RPC actually returns. No id, no user_id, no
// customer_id: this type can never accidentally carry a private field,
// because it was never given one to carry.
export interface PublicCheckoutData {
  paymentCode: string;
  amount: number;
  currency: string;
  network: string;
  description: string | null;
  status: PaymentRequestStatus;
  expiresAt: string | null;
  merchantName: string | null;
  destinationWallet: string | null;
}

export type PublicCheckoutResult =
  | { ok: true; data: PublicCheckoutData }
  | { ok: false; code: 'invalid_token' | 'not_found' | 'network_error'; message: string };
