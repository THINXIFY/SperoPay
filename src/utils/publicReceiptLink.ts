// Mirrors publicPaymentLink.ts/customerPortalLink.ts exactly. Shares
// payment_requests.public_token with getPublicPaymentUrl -- a receipt is a
// different view of the same request, not a new token type.
import { getCheckoutBaseUrl } from './checkoutBaseUrl.ts';

export function getPublicReceiptUrl(publicToken: string): string {
  return `${getCheckoutBaseUrl()}/receipt/${publicToken}`;
}
