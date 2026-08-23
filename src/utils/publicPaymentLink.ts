// The one centralized place that builds a shareable public checkout URL —
// every screen that shows/copies/shares a payment link should call this,
// not construct the string itself (spec section 25).
//
// Deliberately NOT derived from the stored payment_request.payment_link
// column: that value is built client-side, before the row (and its
// server-generated public_token) exists, from the low-entropy payment_code
// — see the Phase 3B design doc's "link-generation timing problem" for why
// public_token can only be known after insert, and why the link is always
// computed fresh from it rather than trusted from a stored string.
//
// EXPO_PUBLIC_CHECKOUT_BASE_URL is unset in local/dev environments — the
// fallback below is the app's real intended production domain (already
// referenced elsewhere, e.g. support@speropay.app), NOT a verified,
// deployed URL. See this phase's final report for the explicit
// implementation-vs-deployment distinction.
const DEFAULT_CHECKOUT_BASE_URL = 'https://pay.speropay.app';

export function getPublicPaymentUrl(publicToken: string): string {
  const base = process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL || DEFAULT_CHECKOUT_BASE_URL;
  const trimmedBase = base.replace(/\/+$/, '');
  return `${trimmedBase}/p/${publicToken}`;
}
