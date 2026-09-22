// Notifications UI refinement -- payment_received/payment_partial messages
// are authored server-side (complete_verified_payment, see the Phase 7
// migration) in the exact fixed shape "<amount> <CURRENCY> received for
// <code>." e.g. "250 USDC received for SP-2K48." This is a presentation-
// only parse of that already-authored string so the Notifications row can
// show the amount and reference on their own visually prominent lines
// (spec: "Make the amount visually easy to notice") -- it never changes,
// re-derives, or replaces the stored title/message, and always falls back
// to rendering the plain message untouched if the shape doesn't match
// (a future copy change server-side degrades gracefully, it never crashes
// or shows garbage).
export interface ParsedPaymentAmount {
  amountText: string;
  currency: string;
  paymentCode: string;
}

const PAYMENT_MESSAGE_PATTERN = /^([\d,]+(?:\.\d+)?)\s+(USDC|EURC)\s+received for\s+(SP-[A-Z0-9]{4,8})\.?$/i;

export function parsePaymentAmountFromMessage(message: string | null | undefined): ParsedPaymentAmount | null {
  if (!message) return null;
  const match = PAYMENT_MESSAGE_PATTERN.exec(message.trim());
  if (!match) return null;
  return { amountText: match[1], currency: match[2].toUpperCase(), paymentCode: match[3].toUpperCase() };
}
