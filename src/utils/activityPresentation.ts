import { Ionicons } from '@expo/vector-icons';
import type { RequestEvent, RequestEventType, PaymentRequest, Customer } from '../types';
import { formatCurrency } from './formatCurrency';

export type ActivityTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export interface ActivityPresentation {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  tone: ActivityTone;
}

// Deliberately its own copy, not a re-export of Request Detail's
// EVENT_LABELS/EVENT_ICONS: those read correctly on a page that's already
// about one specific request ("Payment confirmed" makes sense there), but
// a cross-request activity feed needs the more concrete, business-facing
// voice the spec's own examples use ("Payment received", not "confirmed").
// Intentional wording difference between the two screens, not drift.
const BASE: Record<RequestEventType, { icon: keyof typeof Ionicons.glyphMap; title: string; tone: ActivityTone }> = {
  created: { icon: 'add-circle-outline', title: 'Request created', tone: 'neutral' },
  shared: { icon: 'share-outline', title: 'Request shared', tone: 'neutral' },
  payment_detected: { icon: 'eye-outline', title: 'Payment detected', tone: 'info' },
  payment_confirmed: { icon: 'checkmark-circle', title: 'Payment received', tone: 'success' },
  payment_failed: { icon: 'alert-circle-outline', title: "Payment couldn't be confirmed", tone: 'danger' },
  reminder_sent: { icon: 'notifications-outline', title: 'Reminder sent', tone: 'neutral' },
  reminder_scheduled: { icon: 'alarm-outline', title: 'Reminders scheduled', tone: 'neutral' },
  reminder_failed: { icon: 'warning-outline', title: "Reminder couldn't be sent", tone: 'danger' },
  reminder_cancelled: { icon: 'notifications-off-outline', title: 'Reminders stopped', tone: 'neutral' },
  cancelled: { icon: 'close-circle-outline', title: 'Request cancelled', tone: 'neutral' },
  expired: { icon: 'time-outline', title: 'Request expired', tone: 'warning' },
};

// Enriches a bare request_events row (type + timestamp only) with request/
// customer context for a cross-request activity feed -- Request Detail's
// own Timeline doesn't need this (it's already on that request's page),
// but Notifications/Activity Center shows events from every request at
// once, so "which request, how much, for whom" has to come from somewhere.
// request/customer are best-effort lookups, never assumed present (a
// request can be missing while data is still loading; a customer can be
// undefined for a request with none).
export function describeActivityEvent(
  event: RequestEvent,
  request: PaymentRequest | undefined,
  customer: Customer | undefined
): ActivityPresentation {
  const base = BASE[event.type];
  // recurringPlanId is only ever set on a request generate_recurring_request
  // produced (see migration 0012) -- never on a request the merchant created
  // by hand, so this can never misfire on an ordinary "created" event.
  const isRecurringGenerated = event.type === 'created' && !!request?.recurringPlanId;
  const title = isRecurringGenerated ? 'Recurring request created' : base.title;

  if (!request) {
    return { icon: base.icon, title, tone: base.tone };
  }

  const amountText = `${formatCurrency(request.amount)} ${request.currency}`;
  const who = request.description || customer?.name || 'No customer';
  return { icon: base.icon, title, description: `${who} · ${amountText}`, tone: base.tone };
}
