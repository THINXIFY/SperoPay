import type { ReminderStatus } from '../types';

// Phase 5C: the one place a reminder's internal status/last_error is
// translated into what a merchant actually reads -- mirrors
// customerFacingStatus.ts's exact convention (label/tone, no icon name --
// that's the consuming component's job) so both status systems in this app
// read the same way. No screen should render a raw ReminderStatus or
// payment_reminders.last_error string directly.
export type ReminderPresentationTone = 'success' | 'warning' | 'neutral' | 'danger';

export interface ReminderStatusPresentation {
  label: string;
  tone: ReminderPresentationTone;
}

const STATUS_PRESENTATION: Record<ReminderStatus, ReminderStatusPresentation> = {
  scheduled: { label: 'Scheduled', tone: 'neutral' },
  processing: { label: 'Sending', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export function reminderStatusPresentation(status: ReminderStatus): ReminderStatusPresentation {
  return STATUS_PRESENTATION[status];
}

// Maps the short, machine-oriented reason codes stored in
// payment_reminders.last_error (see process-reminders/index.ts and
// deliveryProvider.ts -- never a raw provider error or stack trace, see
// those files' own discipline around this column) to calm, human-readable
// copy. Deliberately honest about the one reason that will be by far the
// most common today: there is no automatic delivery provider connected yet
// (see deliveryProvider.ts's NullDeliveryProvider) -- this is reported as a
// simple, non-alarming fact, never disguised as a real failure.
export function friendlyReminderReason(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  switch (reason) {
    case 'no_automatic_delivery_provider_configured':
      return 'Automatic delivery is not connected for this account yet.';
    case 'request_no_longer_exists':
      return 'The request this reminder was for no longer exists.';
    case 'request_expired':
      return 'The request expired before this reminder was due.';
    case 'schedule_disabled':
      return 'Reminders were turned off before this one was sent.';
    case 'processing_error':
      return "A temporary issue occurred. We'll retry automatically.";
    default:
      // Covers request_status_is_paid / request_status_is_cancelled /
      // request_status_is_confirming (see process-reminders/index.ts) --
      // all the same underlying story from a merchant's point of view.
      if (reason.startsWith('request_status_is_')) {
        return 'The request was already resolved before this reminder was due.';
      }
      return "We couldn't send this reminder.";
  }
}
