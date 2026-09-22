import type { PaymentRequestStatus, DepositType, RecurringFrequency } from '../../types';
import type { AssetSymbol } from '../../config/assets';

// Mirrors get_customer_portal's exact return shape -- no id, no user_id,
// no customer_id. This type can never carry a private field because it
// was never given one to carry (same discipline as PublicCheckoutData).
export interface CustomerPortalIdentity {
  merchantName: string | null;
  merchantLogoUrl: string | null;
  customerName: string | null;
}

// Mirrors get_customer_portal_requests. publicToken is the REQUEST's own
// pre-existing public token (Phase 3B) -- what "Pay now" deep-links to at
// /p/<publicToken>, reusing the existing checkout entirely.
export interface CustomerPortalRequest {
  publicToken: string;
  /** Customer-facing request number (e.g. "SP-XXXXX") -- already shown publicly on invoices/receipts/checkout, safe to surface here too. */
  paymentCode: string;
  description: string | null;
  amount: number;
  currency: AssetSymbol;
  network: string;
  status: PaymentRequestStatus;
  dueAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  allowPartialPayments: boolean;
  depositType: DepositType | null;
  depositValue: number | null;
  verifiedPaidAmount: number;
  remainingAmount: number;
}

// Mirrors get_customer_portal_payments -- verified transactions only.
export interface CustomerPortalPayment {
  requestPublicToken: string;
  requestDescription: string | null;
  amount: number;
  currency: AssetSymbol;
  txHash: string;
  paidAt: string;
}

// Mirrors get_customer_portal_recurring -- informational only, no id.
export interface CustomerPortalRecurringPlan {
  description: string | null;
  amount: number;
  currency: AssetSymbol;
  frequency: RecurringFrequency;
  customIntervalDays: number | null;
  nextRunAt: string;
}

export interface CustomerPortalData {
  identity: CustomerPortalIdentity;
  requests: CustomerPortalRequest[];
  payments: CustomerPortalPayment[];
  recurring: CustomerPortalRecurringPlan[];
}

export type CustomerPortalResult =
  | { ok: true; data: CustomerPortalData }
  | { ok: false; code: 'invalid_token' | 'not_found' | 'network_error'; message: string };
