import { supabase } from '../../lib/supabase';
import type { PublicCheckoutData, PublicCheckoutResult } from './types';

// public_token is a Postgres gen_random_uuid() — a standard UUID. Checking
// the shape before making a network call rejects an obviously-malformed
// link (a stray character, a truncated copy-paste) instantly, without a
// round trip, and without ever sending a non-UUID string to the RPC.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidPublicToken(token: string): boolean {
  return UUID_PATTERN.test(token);
}

interface PublicCheckoutRpcRow {
  payment_code: string;
  amount: number | string;
  currency: string;
  network: string;
  description: string | null;
  status: string;
  expires_at: string | null;
  merchant_name: string | null;
  destination_wallet: string | null;
}

function normalize(row: PublicCheckoutRpcRow): PublicCheckoutData {
  return {
    paymentCode: row.payment_code,
    amount: Number(row.amount),
    currency: row.currency,
    network: row.network,
    description: row.description,
    status: row.status as PublicCheckoutData['status'],
    expiresAt: row.expires_at,
    merchantName: row.merchant_name,
    destinationWallet: row.destination_wallet,
  };
}

// The single entry point a public checkout screen uses — never queries
// payment_requests/wallets/profiles directly, and never touches any
// merchant-authenticated Zustand store (spec section 4). Uses the same
// shared Supabase client the rest of the app does: reading public data via
// an anon-granted RPC needs no separate client or session (see design doc).
export async function fetchPublicCheckout(token: string): Promise<PublicCheckoutResult> {
  if (!isValidPublicToken(token)) {
    return { ok: false, code: 'invalid_token', message: 'This payment link is invalid.' };
  }

  let response;
  try {
    response = await supabase.rpc('get_public_payment_request', { p_token: token });
  } catch {
    return { ok: false, code: 'network_error', message: "We couldn't load this payment. Check your connection and try again." };
  }

  if (response.error) {
    return { ok: false, code: 'network_error', message: "We couldn't load this payment. Check your connection and try again." };
  }

  const rows = (response.data ?? []) as PublicCheckoutRpcRow[];
  if (rows.length === 0) {
    return { ok: false, code: 'not_found', message: 'This link may be invalid or no longer available.' };
  }

  return { ok: true, data: normalize(rows[0]) };
}
