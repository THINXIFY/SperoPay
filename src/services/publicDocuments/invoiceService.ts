import { supabase } from '../../lib/supabase';
import type { PaymentRequestStatus } from '../../types';
import type { PublicInvoiceData, PublicInvoiceResult } from './types';

// Same shape check as publicCheckoutService's isValidPublicToken /
// customerPortalService's isValidPortalToken -- public_token is a Postgres
// gen_random_uuid() too, so a standard UUID regex is the correct,
// sufficient pre-flight check before ever spending a network round trip.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidPublicToken(token: string): boolean {
  return UUID_PATTERN.test(token);
}

const KNOWN_STATUSES: ReadonlySet<PaymentRequestStatus> = new Set([
  'pending',
  'confirming',
  'paid',
  'expired',
  'cancelled',
]);

// Exported so receiptService.ts (which reads the same status column via
// get_public_invoice) shares one definition of "known" rather than a second
// copy that could silently drift if a new status is ever added.
export function isKnownStatus(status: string): status is PaymentRequestStatus {
  return KNOWN_STATUSES.has(status as PaymentRequestStatus);
}

interface InvoiceRpcRow {
  payment_code: string;
  amount: number | string;
  currency: string;
  network: string;
  description: string | null;
  status: string;
  created_at: string;
  due_at: string | null;
  expires_at: string | null;
  merchant_name: string | null;
  merchant_logo_url: string | null;
  customer_name: string | null;
  allow_partial_payments: boolean;
  deposit_type: PublicInvoiceData['depositType'];
  deposit_value: number | string | null;
  verified_paid_amount: number | string;
  remaining_amount: number | string;
}

function normalize(row: InvoiceRpcRow): PublicInvoiceData {
  return {
    paymentCode: row.payment_code,
    amount: Number(row.amount),
    currency: row.currency as PublicInvoiceData['currency'],
    network: row.network,
    description: row.description,
    status: row.status as PublicInvoiceData['status'],
    createdAt: row.created_at,
    dueAt: row.due_at,
    expiresAt: row.expires_at,
    merchantName: row.merchant_name,
    merchantLogoUrl: row.merchant_logo_url,
    customerName: row.customer_name,
    allowPartialPayments: row.allow_partial_payments,
    depositType: row.deposit_type,
    depositValue: row.deposit_value != null ? Number(row.deposit_value) : null,
    verifiedPaidAmount: Number(row.verified_paid_amount),
    remainingAmount: Number(row.remaining_amount),
  };
}

// The single entry point the public invoice page uses -- never queries
// payment_requests/customers/business_profiles directly, and never touches
// any merchant-authenticated Zustand store (same rule publicCheckoutService/
// customerPortalService follow).
export async function fetchPublicInvoice(token: string): Promise<PublicInvoiceResult> {
  if (!isValidPublicToken(token)) {
    return { ok: false, code: 'invalid_token', message: 'This invoice link is invalid.' };
  }

  let response;
  try {
    response = await supabase.rpc('get_public_invoice', { p_token: token });
  } catch {
    return { ok: false, code: 'network_error', message: "We couldn't load this invoice. Check your connection and try again." };
  }

  if (response.error) {
    return { ok: false, code: 'network_error', message: "We couldn't load this invoice. Check your connection and try again." };
  }

  const rows = (response.data ?? []) as InvoiceRpcRow[];
  if (rows.length === 0) {
    return { ok: false, code: 'not_found', message: 'This link may be invalid or no longer available.' };
  }

  if (!isKnownStatus(rows[0].status)) {
    // Fail closed rather than pass an unrecognized status through to the UI
    // -- same rule fetchPublicCheckout follows.
    return { ok: false, code: 'network_error', message: "We couldn't load this invoice. Check your connection and try again." };
  }

  return { ok: true, data: normalize(rows[0]) };
}
