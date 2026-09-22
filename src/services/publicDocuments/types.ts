import type { PaymentRequestStatus, DepositType } from '../../types';
import type { AssetSymbol } from '../../config/assets';

// Mirrors get_public_invoice's exact return shape -- no id, no user_id, no
// customer_id, no business_email (neither get_public_payment_request nor
// get_customer_portal exposes it either -- same discipline as
// PublicCheckoutData/CustomerPortalIdentity).
export interface PublicInvoiceData {
  paymentCode: string;
  amount: number;
  currency: AssetSymbol;
  network: string;
  description: string | null;
  status: PaymentRequestStatus;
  createdAt: string;
  dueAt: string | null;
  expiresAt: string | null;
  merchantName: string | null;
  merchantLogoUrl: string | null;
  customerName: string | null;
  allowPartialPayments: boolean;
  depositType: DepositType | null;
  depositValue: number | null;
  verifiedPaidAmount: number;
  remainingAmount: number;
}

export type PublicInvoiceResult =
  | { ok: true; data: PublicInvoiceData }
  | { ok: false; code: 'invalid_token' | 'not_found' | 'network_error'; message: string };

// Mirrors get_public_receipt -- one row per verified transaction.
export interface PublicReceiptPayment {
  amount: number;
  currency: AssetSymbol;
  paidAt: string;
  txHash: string;
}

// A receipt is the invoice's identity/accounting context plus the list of
// payments actually made against it -- composed client-side from two RPCs
// (see receiptService.ts), not a single flat row. `payments` can be empty
// even on an `ok: true` result (nothing paid yet) -- the UI renders that as
// an empty/awaiting-payment state, the same "possibly-empty, still valid"
// convention CustomerPortalData.requests already uses.
export interface PublicReceiptData {
  paymentCode: string;
  description: string | null;
  merchantName: string | null;
  merchantLogoUrl: string | null;
  customerName: string | null;
  network: string;
  currency: AssetSymbol;
  status: PaymentRequestStatus;
  dueAt: string | null;
  totalAmount: number;
  verifiedPaidAmount: number;
  remainingAmount: number;
  payments: PublicReceiptPayment[];
}

export type PublicReceiptResult =
  | { ok: true; data: PublicReceiptData }
  | { ok: false; code: 'invalid_token' | 'not_found' | 'network_error'; message: string };
