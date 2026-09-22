import { shouldRetryReminderDelivery } from '../shouldRetryReminderDelivery';

describe('shouldRetryReminderDelivery', () => {
  it('never retries a successful delivery -- a sent reminder is never resent', () => {
    expect(shouldRetryReminderDelivery({ delivered: true, channel: 'email' })).toBe(false);
    // Even a malformed result that somehow set both -- delivered always wins.
    expect(shouldRetryReminderDelivery({ delivered: true, retryable: true })).toBe(false);
  });

  it('retries a failure explicitly marked retryable', () => {
    expect(shouldRetryReminderDelivery({ delivered: false, reason: 'resend_network_error', retryable: true })).toBe(true);
  });

  it('does not retry a failure marked non-retryable (permanent)', () => {
    expect(shouldRetryReminderDelivery({ delivered: false, reason: 'no_customer_email', retryable: false })).toBe(false);
  });

  it('defaults to not retrying when retryable is left unset (e.g. NullDeliveryProvider)', () => {
    expect(shouldRetryReminderDelivery({ delivered: false, reason: 'no_automatic_delivery_provider_configured' })).toBe(false);
  });
});
