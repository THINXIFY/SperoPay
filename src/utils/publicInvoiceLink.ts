// Mirrors publicPaymentLink.ts/customerPortalLink.ts exactly -- domain
// resolution lives in checkoutBaseUrl.ts (Phase 5B) so no link type can
// drift to a different domain. Shares payment_requests.public_token with
// getPublicPaymentUrl -- an invoice is a different view of the same
// request, not a new token type.
import { getCheckoutBaseUrl } from './checkoutBaseUrl.ts';

export function getPublicInvoiceUrl(publicToken: string): string {
  return `${getCheckoutBaseUrl()}/invoice/${publicToken}`;
}
