// Mirrors publicPaymentLink.ts exactly -- same "never derive the token,
// always take the real one" principle. Domain resolution itself lives in
// checkoutBaseUrl.ts (Phase 5B), shared with getPublicPaymentUrl so both
// link types can never drift to different domains.
import { getCheckoutBaseUrl } from './checkoutBaseUrl.ts';

export function getCustomerPortalUrl(portalToken: string): string {
  return `${getCheckoutBaseUrl()}/c/${portalToken}`;
}
