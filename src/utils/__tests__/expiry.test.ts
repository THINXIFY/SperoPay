import { calculateExpiresAt, isRequestExpired } from '../expiry';

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

describe('isRequestExpired', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('is never expired when expiresAt is null', () => {
    expect(isRequestExpired({ expiresAt: null }, now)).toBe(false);
  });

  it('is expired when expiresAt is in the past', () => {
    expect(isRequestExpired({ expiresAt: '2026-08-18T11:00:00.000Z' }, now)).toBe(true);
  });

  it('is not expired when expiresAt is in the future', () => {
    expect(isRequestExpired({ expiresAt: '2026-08-18T13:00:00.000Z' }, now)).toBe(false);
  });

  it('treats expiresAt exactly equal to now as expired', () => {
    expect(isRequestExpired({ expiresAt: '2026-08-18T12:00:00.000Z' }, now)).toBe(true);
  });
});
