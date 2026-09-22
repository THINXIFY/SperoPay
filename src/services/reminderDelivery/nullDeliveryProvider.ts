import type { ReminderDeliveryContext, ReminderDeliveryProvider, ReminderDeliveryResult } from './types.ts';

// The safe fallback: whenever no real provider is configured (no
// RESEND_API_KEY/REMINDER_FROM_EMAIL secret set), process-reminders/
// index.ts falls back to this instead of ResendDeliveryProvider. Never
// claims a message was sent when none was -- retryable is deliberately
// left unset/false, since retrying can never make a provider that doesn't
// exist start existing; every reminder simply stays 'skipped', exactly as
// it did before this phase's work.
export class NullDeliveryProvider implements ReminderDeliveryProvider {
  async send(_context: ReminderDeliveryContext): Promise<ReminderDeliveryResult> {
    return {
      delivered: false,
      reason: 'no_automatic_delivery_provider_configured',
      retryable: false,
    };
  }
}
