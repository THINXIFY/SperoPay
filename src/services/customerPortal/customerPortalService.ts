import { supabase } from '../../lib/supabase';
import type {
  CustomerPortalData,
  CustomerPortalIdentity,
  CustomerPortalPayment,
  CustomerPortalRecurringPlan,
  CustomerPortalRequest,
  CustomerPortalResult,
} from './types';

// Same shape check as publicCheckoutService's isValidPublicToken -- a
// portal_token is a Postgres gen_random_uuid() too, so a standard UUID
// regex is the correct, sufficient pre-flight check before ever spending
// a network round trip on an obviously-malformed link.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidPortalToken(token: string): boolean {
  return UUID_PATTERN.test(token);
}

interface IdentityRow {
  merchant_name: string | null;
  merchant_logo_url: string | null;
  customer_name: string | null;
}

interface RequestRow {
  request_public_token: string;
  payment_code: string;
  description: string | null;
  amount: number | string;
  currency: string;
  network: string;
  status: string;
  due_at: string | null;
  expires_at: string | null;
  created_at: string;
  allow_partial_payments: boolean;
  deposit_type: CustomerPortalRequest['depositType'];
  deposit_value: number | string | null;
  verified_paid_amount: number | string;
  remaining_amount: number | string;
}

interface PaymentRow {
  request_public_token: string;
  request_description: string | null;
  amount: number | string;
  currency: string;
  tx_hash: string;
  paid_at: string;
}

interface RecurringRow {
  description: string | null;
  amount: number | string;
  currency: string;
  frequency: CustomerPortalRecurringPlan['frequency'];
  custom_interval_days: number | null;
  next_run_at: string;
}

function mapIdentity(row: IdentityRow): CustomerPortalIdentity {
  return { merchantName: row.merchant_name, merchantLogoUrl: row.merchant_logo_url, customerName: row.customer_name };
}

function mapRequest(row: RequestRow): CustomerPortalRequest {
  return {
    publicToken: row.request_public_token,
    paymentCode: row.payment_code,
    description: row.description,
    amount: Number(row.amount),
    // Trusted: sourced from payment_requests.currency, which the Phase 7
    // migration constrains to the allowlisted registry values.
    currency: row.currency as CustomerPortalRequest['currency'],
    network: row.network,
    status: row.status as CustomerPortalRequest['status'],
    dueAt: row.due_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    allowPartialPayments: row.allow_partial_payments,
    depositType: row.deposit_type,
    depositValue: row.deposit_value != null ? Number(row.deposit_value) : null,
    verifiedPaidAmount: Number(row.verified_paid_amount),
    remainingAmount: Number(row.remaining_amount),
  };
}

function mapPayment(row: PaymentRow): CustomerPortalPayment {
  return {
    requestPublicToken: row.request_public_token,
    requestDescription: row.request_description,
    amount: Number(row.amount),
    currency: row.currency as CustomerPortalPayment['currency'],
    txHash: row.tx_hash,
    paidAt: row.paid_at,
  };
}

function mapRecurring(row: RecurringRow): CustomerPortalRecurringPlan {
  return {
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency as CustomerPortalRecurringPlan['currency'],
    frequency: row.frequency,
    customIntervalDays: row.custom_interval_days,
    nextRunAt: row.next_run_at,
  };
}

// The single entry point a portal screen uses -- never queries customers/
// payment_requests/transactions/recurring_payment_plans directly, and
// never touches any merchant-authenticated Zustand store (same rule
// publicCheckoutService follows). Four independent RPC calls run in
// parallel (see migration 0014 for why one flat function can't return
// this): each one re-derives the owning customer from the token itself,
// so there is no shared trust boundary between them to get wrong.
export async function fetchCustomerPortal(token: string): Promise<CustomerPortalResult> {
  if (!isValidPortalToken(token)) {
    return { ok: false, code: 'invalid_token', message: 'The link is malformed or incomplete.' };
  }

  let identityResponse, requestsResponse, paymentsResponse, recurringResponse;
  try {
    [identityResponse, requestsResponse, paymentsResponse, recurringResponse] = await Promise.all([
      supabase.rpc('get_customer_portal', { p_token: token }),
      supabase.rpc('get_customer_portal_requests', { p_token: token }),
      supabase.rpc('get_customer_portal_payments', { p_token: token }),
      supabase.rpc('get_customer_portal_recurring', { p_token: token }),
    ]);
  } catch {
    return { ok: false, code: 'network_error', message: 'Check your connection and try again.' };
  }

  if (identityResponse.error || requestsResponse.error || paymentsResponse.error || recurringResponse.error) {
    return { ok: false, code: 'network_error', message: 'Check your connection and try again.' };
  }

  const identityRows = (identityResponse.data ?? []) as IdentityRow[];
  if (identityRows.length === 0) {
    return { ok: false, code: 'not_found', message: 'It may have been revoked, or the link was typed incorrectly.' };
  }

  const data: CustomerPortalData = {
    identity: mapIdentity(identityRows[0]),
    requests: ((requestsResponse.data ?? []) as RequestRow[]).map(mapRequest),
    payments: ((paymentsResponse.data ?? []) as PaymentRow[]).map(mapPayment),
    recurring: ((recurringResponse.data ?? []) as RecurringRow[]).map(mapRecurring),
  };

  return { ok: true, data };
}
