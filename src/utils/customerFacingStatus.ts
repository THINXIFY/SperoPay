import type { PaymentRequestStatus } from '../types';

// The one place an internal payment_requests.status (or the absence of
// one, for a derived state like "partially paid" or "overdue" that is
// never itself stored) is translated into what a customer actually reads.
// No screen in the portal should ever render a raw status string directly
// -- every one of them goes through this function first.
export type CustomerFacingTone = 'neutral' | 'warning' | 'danger' | 'info' | 'success';

export interface CustomerFacingStatus {
  label: string;
  /** Present only where the extra reassurance matters (e.g. "confirming"). */
  subcopy?: string;
  tone: CustomerFacingTone;
}

const DUE_SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export interface DeriveStatusParams {
  status: PaymentRequestStatus;
  dueAt: string | null;
  verifiedPaidAmount: number;
  remainingAmount: number;
  now?: Date;
}

export function deriveCustomerFacingStatus(params: DeriveStatusParams): CustomerFacingStatus {
  const { status, dueAt, verifiedPaidAmount, remainingAmount, now = new Date() } = params;

  if (status === 'paid') {
    return { label: 'Paid', tone: 'success' };
  }
  if (status === 'cancelled') {
    return { label: 'Cancelled', tone: 'neutral' };
  }
  if (status === 'expired') {
    return { label: 'Expired', tone: 'neutral' };
  }
  if (status === 'confirming') {
    return { label: 'Payment detected', subcopy: "We're confirming your payment.", tone: 'info' };
  }

  // status === 'pending' from here -- every remaining nuance (partially
  // paid / overdue / due soon / plain pending) is a pure client-side
  // derivation, never a stored value.
  if (verifiedPaidAmount > 0 && remainingAmount > 0) {
    return { label: 'Partially paid', tone: 'warning' };
  }
  if (dueAt) {
    const dueTime = new Date(dueAt).getTime();
    if (dueTime <= now.getTime()) {
      return { label: 'Overdue', tone: 'danger' };
    }
    if (dueTime - now.getTime() <= DUE_SOON_WINDOW_MS) {
      return { label: 'Due soon', tone: 'warning' };
    }
  }
  return { label: 'Pending', tone: 'neutral' };
}
