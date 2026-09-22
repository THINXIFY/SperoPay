import { isAuthorizedCronRequest } from '../cronAuth';

describe('isAuthorizedCronRequest', () => {
  it('authorizes a request whose header exactly matches the configured secret', () => {
    expect(isAuthorizedCronRequest('super-secret-value', 'super-secret-value')).toBe(true);
  });

  it('rejects a request with the wrong secret', () => {
    expect(isAuthorizedCronRequest('super-secret-value', 'wrong-value')).toBe(false);
  });

  it('rejects a request with no header at all', () => {
    expect(isAuthorizedCronRequest('super-secret-value', null)).toBe(false);
    expect(isAuthorizedCronRequest('super-secret-value', undefined)).toBe(false);
  });

  // Fail-closed, not fail-open: a function whose own secret was never
  // configured must never treat "nothing to compare against" as "anything
  // goes" -- this is what makes a misconfigured deployment safe by
  // default rather than silently wide open.
  it('rejects every request when the secret itself was never configured, even an empty header', () => {
    expect(isAuthorizedCronRequest(undefined, undefined)).toBe(false);
    expect(isAuthorizedCronRequest(null, null)).toBe(false);
    expect(isAuthorizedCronRequest('', '')).toBe(false);
  });

  // One function's configured secret must never authorize a call meant for
  // a different function -- REMINDER_CRON_SECRET and RECURRING_CRON_SECRET
  // are independent values, so a caller holding one must not be able to
  // invoke the other.
  it('does not authorize when the provided secret matches a DIFFERENT function\'s secret', () => {
    const reminderSecret = 'reminder-only-secret';
    const recurringSecret = 'recurring-only-secret';
    expect(isAuthorizedCronRequest(reminderSecret, recurringSecret)).toBe(false);
    expect(isAuthorizedCronRequest(recurringSecret, reminderSecret)).toBe(false);
  });
});
