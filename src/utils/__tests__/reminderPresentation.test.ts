import { reminderStatusPresentation, friendlyReminderReason } from '../reminderPresentation';

describe('reminderStatusPresentation', () => {
  it('labels every status a human would recognize', () => {
    expect(reminderStatusPresentation('scheduled')).toEqual({ label: 'Scheduled', tone: 'neutral' });
    expect(reminderStatusPresentation('processing')).toEqual({ label: 'Sending', tone: 'neutral' });
    expect(reminderStatusPresentation('sent')).toEqual({ label: 'Sent', tone: 'success' });
    expect(reminderStatusPresentation('failed')).toEqual({ label: 'Failed', tone: 'danger' });
    expect(reminderStatusPresentation('skipped')).toEqual({ label: 'Skipped', tone: 'neutral' });
    expect(reminderStatusPresentation('cancelled')).toEqual({ label: 'Cancelled', tone: 'neutral' });
  });
});

describe('friendlyReminderReason', () => {
  it('returns undefined for no reason at all', () => {
    expect(friendlyReminderReason(undefined)).toBeUndefined();
  });

  it('is honest that no automatic delivery provider is connected, without alarming language', () => {
    const message = friendlyReminderReason('no_automatic_delivery_provider_configured');
    expect(message).toMatch(/not connected/i);
    expect(message).not.toMatch(/fail/i);
  });

  it('never surfaces the raw internal reason code', () => {
    const codes = [
      'no_automatic_delivery_provider_configured',
      'request_no_longer_exists',
      'request_expired',
      'schedule_disabled',
      'processing_error',
      'request_status_is_paid',
      'request_status_is_cancelled',
      'some_unexpected_future_code',
    ];
    for (const code of codes) {
      const message = friendlyReminderReason(code);
      expect(message).toBeDefined();
      expect(message).not.toBe(code);
      expect(message).not.toMatch(/_/); // a raw snake_case code leaking through would fail this
    }
  });

  it('maps every request_status_is_* variant to the same plain-language explanation', () => {
    expect(friendlyReminderReason('request_status_is_paid')).toBe(friendlyReminderReason('request_status_is_confirming'));
  });

  it('falls back to a generic, calm message for an unrecognized reason', () => {
    expect(friendlyReminderReason('totally_unknown_code')).toBe("We couldn't send this reminder.");
  });
});
