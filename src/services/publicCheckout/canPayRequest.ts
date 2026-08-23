import type { PaymentRequestStatus } from '../../types';

// A payer can only ever initiate payment while a request is genuinely
// still open. Every other status (confirming/paid/expired/cancelled) must
// hide the Pay controls entirely -- this is the single source of truth
// the checkout screen and its tests both check against.
export function canPayRequest(status: PaymentRequestStatus): boolean {
  return status === 'pending';
}
