// Imported directly from their own files, not the '../types' barrel, and
// with explicit '.ts' extensions -- this module is reachable from the
// process-reminders Edge Function's dependency graph (Deno), whose local-
// module resolution requires a full, explicit relative path on every hop
// (no Node/Metro-style "resolve a bare directory to its index" behavior).
// Safe for the RN/Metro app too -- see paymentAccounting.ts for the same
// pattern, already proven working for both runtimes via tsconfig's
// allowImportingTsExtensions.
import type { PaymentRequest } from '../types/payment.ts';
import type { Customer } from '../types/customer.ts';
import type { ReminderRuleType } from '../types/reminder.ts';
import { getPublicPaymentUrl } from './publicPaymentLink.ts';

// Separate from buildReminderMessage.ts (the merchant's own manual
// Share/WhatsApp/copy message, always one generic tone) -- an automatic
// reminder's tone must match how late the payment actually is, which
// buildReminderMessage has no notion of. Both intentionally never mention
// an internal payment ID, wallet address, or anything else that isn't
// meaningful to the customer paying the link.
function greeting(customer: Customer | undefined): string {
  const firstName = customer?.name?.trim().split(' ')[0];
  return firstName ? `Hi ${firstName},` : 'Hello,';
}

// Phase 4C: when a request has already received a partial payment, a
// reminder must talk about the REMAINING balance, never the original full
// amount -- re-reminding someone about $1,000 when they already paid $300
// reads as broken, not just imprecise. `remainingAmount` is omitted (or
// equal to the full amount) for an ordinary, never-partially-paid request,
// which keeps every existing call site's copy byte-for-byte unchanged.
export function buildAutomaticReminderMessage(
  reminderType: ReminderRuleType,
  request: PaymentRequest,
  customer: Customer | undefined,
  remainingAmount?: number
): string {
  const isPartial = remainingAmount != null && remainingAmount < request.amount;
  const amountLabel = `${isPartial ? remainingAmount : request.amount} ${request.currency}`;
  const descriptionClause = request.description ? ` for ${request.description}` : '';
  const link = getPublicPaymentUrl(request.publicToken);
  const subject = isPartial
    ? `A remaining balance of ${amountLabel}${descriptionClause}`
    : `Your payment of ${amountLabel}${descriptionClause}`;

  const body =
    reminderType === 'before_due'
      ? `This is a friendly reminder that ${subject.charAt(0).toLowerCase() + subject.slice(1)} will be due soon.`
      : reminderType === 'on_due'
        ? `${subject} is due today.`
        : `${subject} is now overdue. Please complete it as soon as you can.`;

  return `${greeting(customer)}\n\n${body}\n\nYou can complete it using the payment link below.\n${link}`;
}
