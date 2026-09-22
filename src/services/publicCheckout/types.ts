import type { PaymentRequestStatus, DepositType } from '../../types';
import type { AssetSymbol } from '../../config/assets';

// Mirrors get_public_payment_request's exact return shape
// (supabase/migrations/0005_phase3a_payment_foundation.sql) — deliberately
// only the fields that RPC actually returns. No id, no user_id, no
// customer_id: this type can never accidentally carry a private field,
// because it was never given one to carry.
export interface PublicCheckoutData {
  paymentCode: string;
  amount: number;
  currency: AssetSymbol;
  network: string;
  description: string | null;
  status: PaymentRequestStatus;
  expiresAt: string | null;
  merchantName: string | null;
  merchantLogoUrl: string | null;
  destinationWallet: string | null;
  solanaReference: string | null;
  allowPartialPayments: boolean;
  depositType: DepositType | null;
  depositValue: number | null;
  // Server-derived from real transactions -- see get_public_payment_request
  // (migration 0012). Never computed client-side; this is the number the
  // checkout page's "Paid" / "Remaining" figures come from directly.
  verifiedPaidAmount: number;
  remainingAmount: number;
}

export type PublicCheckoutResult =
  | { ok: true; data: PublicCheckoutData }
  | { ok: false; code: 'invalid_token' | 'not_found' | 'network_error'; message: string };
