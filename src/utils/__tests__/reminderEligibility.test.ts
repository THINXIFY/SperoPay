import { determineReminderIneligibilityReason } from '../reminderEligibility';

const NOW = new Date('2026-09-21T12:00:00.000Z');

describe('determineReminderIneligibilityReason', () => {
  it('is eligible (null reason) for a pending, unexpired request with no schedule to check', () => {
    const reason = determineReminderIneligibilityReason({
      request: { status: 'pending', expiresAt: null },
      scheduleEnabled: null,
      now: NOW,
    });
    expect(reason).toBeNull();
  });

  it('is eligible when the schedule was checked and is enabled', () => {
    const reason = determineReminderIneligibilityReason({
      request: { status: 'pending', expiresAt: null },
      scheduleEnabled: true,
      now: NOW,
    });
    expect(reason).toBeNull();
  });

  it('is ineligible when the underlying request no longer exists', () => {
    const reason = determineReminderIneligibilityReason({ request: null, scheduleEnabled: null, now: NOW });
    expect(reason).toBe('request_no_longer_exists');
  });

  // The exact "Paid/Cancelled/Expired requests are handled correctly"
  // requirement: any non-'pending' status is ineligible, whatever it is --
  // this never hardcodes a finite allowlist of "bad" statuses that could
  // silently miss a new one added later.
  it.each(['paid', 'cancelled', 'confirming'])('is ineligible when the request status is "%s"', (status) => {
    const reason = determineReminderIneligibilityReason({ request: { status, expiresAt: null }, scheduleEnabled: null, now: NOW });
    expect(reason).toBe(`request_status_is_${status}`);
  });

  it('is ineligible once the request has expired', () => {
    const reason = determineReminderIneligibilityReason({
      request: { status: 'pending', expiresAt: '2026-09-21T11:00:00.000Z' },
      scheduleEnabled: null,
      now: NOW,
    });
    expect(reason).toBe('request_expired');
  });

  it('is still eligible for an expiry that has not arrived yet', () => {
    const reason = determineReminderIneligibilityReason({
      request: { status: 'pending', expiresAt: '2026-09-21T13:00:00.000Z' },
      scheduleEnabled: null,
      now: NOW,
    });
    expect(reason).toBeNull();
  });

  it('is ineligible when the merchant disabled the reminder schedule in the meantime', () => {
    const reason = determineReminderIneligibilityReason({
      request: { status: 'pending', expiresAt: null },
      scheduleEnabled: false,
      now: NOW,
    });
    expect(reason).toBe('schedule_disabled');
  });

  // Status is checked before expiry, and expiry before the schedule --
  // matches the exact precedence process-reminders/index.ts always used,
  // so a request that is BOTH paid AND has a disabled schedule is reported
  // as the (more informative) status reason, not the schedule one.
  it('status takes precedence over expiry and schedule when a request is both terminal and expired', () => {
    const reason = determineReminderIneligibilityReason({
      request: { status: 'cancelled', expiresAt: '2026-01-01T00:00:00.000Z' },
      scheduleEnabled: false,
      now: NOW,
    });
    expect(reason).toBe('request_status_is_cancelled');
  });
});
