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
// Domain resolution itself lives in checkoutBaseUrl.ts (Phase 5B) -- shared
// with getCustomerPortalUrl, so both link types can never drift to
// different domains.
import { getCheckoutBaseUrl } from './checkoutBaseUrl.ts';

export function getPublicPaymentUrl(publicToken: string): string {
  return `${getCheckoutBaseUrl()}/p/${publicToken}`;
}
