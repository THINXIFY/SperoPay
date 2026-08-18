import { calculateExpiresAt } from '../expiry';

describe('calculateExpiresAt', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('adds 1 hour for "1h"', () => {
    expect(calculateExpiresAt('1h', now)).toBe('2026-08-18T13:00:00.000Z');
  });

  it('adds 24 hours for "24h"', () => {
    expect(calculateExpiresAt('24h', now)).toBe('2026-08-19T12:00:00.000Z');
  });

  it('adds 7 days for "7d"', () => {
    expect(calculateExpiresAt('7d', now)).toBe('2026-08-25T12:00:00.000Z');
  });

  it('returns null for "never"', () => {
    expect(calculateExpiresAt('never', now)).toBeNull();
  });
});
