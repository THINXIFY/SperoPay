import { supabase } from '../../lib/supabase';
import { isValidPublicToken, isKnownStatus } from './invoiceService';
import type { PublicReceiptData, PublicReceiptPayment, PublicReceiptResult } from './types';

interface InvoiceHeaderRow {
  payment_code: string;
  currency: string;
  description: string | null;
  status: string;
  due_at: string | null;
  merchant_name: string | null;
  merchant_logo_url: string | null;
  customer_name: string | null;
  network: string;
  amount: number | string;
  verified_paid_amount: number | string;
  remaining_amount: number | string;
}

interface PaymentRow {
  amount: number | string;
  currency: string;
  paid_at: string;
  tx_hash: string;
}

function mapPayment(row: PaymentRow): PublicReceiptPayment {
  return {
    amount: Number(row.amount),
    currency: row.currency as PublicReceiptPayment['currency'],
    paidAt: row.paid_at,
    txHash: row.tx_hash,
  };
}

// A receipt is composed from two RPCs, exactly like the customer portal
// composes 4 -- get_public_invoice supplies identity/accounting context
// (the SAME call the public invoice page makes, deliberately not a
// receipt-specific duplicate of those columns), get_public_receipt supplies
// the actual payment lines. Both run in parallel; there is no ordering
// dependency between them.
export async function fetchPublicReceipt(token: string): Promise<PublicReceiptResult> {
  if (!isValidPublicToken(token)) {
    return { ok: false, code: 'invalid_token', message: 'This receipt link is invalid.' };
  }

  let invoiceResponse, paymentsResponse;
  try {
    [invoiceResponse, paymentsResponse] = await Promise.all([
      supabase.rpc('get_public_invoice', { p_token: token }),
      supabase.rpc('get_public_receipt', { p_token: token }),
    ]);
  } catch {
    return { ok: false, code: 'network_error', message: "We couldn't load this receipt. Check your connection and try again." };
  }

  if (invoiceResponse.error || paymentsResponse.error) {
    return { ok: false, code: 'network_error', message: "We couldn't load this receipt. Check your connection and try again." };
  }

  const invoiceRows = (invoiceResponse.data ?? []) as InvoiceHeaderRow[];
  if (invoiceRows.length === 0) {
    return { ok: false, code: 'not_found', message: 'This link may be invalid or no longer available.' };
  }

  const header = invoiceRows[0];
  if (!isKnownStatus(header.status)) {
    return { ok: false, code: 'network_error', message: "We couldn't load this receipt. Check your connection and try again." };
  }

  const data: PublicReceiptData = {
    paymentCode: header.payment_code,
    description: header.description,
    merchantName: header.merchant_name,
    merchantLogoUrl: header.merchant_logo_url,
    customerName: header.customer_name,
    network: header.network,
    currency: header.currency as PublicReceiptData['currency'],
    status: header.status,
    dueAt: header.due_at,
    totalAmount: Number(header.amount),
    verifiedPaidAmount: Number(header.verified_paid_amount),
    remainingAmount: Number(header.remaining_amount),
    payments: ((paymentsResponse.data ?? []) as PaymentRow[]).map(mapPayment),
  };

  return { ok: true, data };
}
