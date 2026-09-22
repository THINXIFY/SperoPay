import { calculateExpiresAt, isRequestExpired, findNewlyExpiredPendingRequestIds } from '../expiry';

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

describe('findNewlyExpiredPendingRequestIds', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  function req(id: string, status: string, expiresAt: string | null) {
    return { id, status, expiresAt };
  }

  it('returns a still-pending request past its expiry', () => {
    const ids = findNewlyExpiredPendingRequestIds([req('r1', 'pending', '2026-08-18T11:00:00.000Z')], new Set(), now);
    expect(ids).toEqual(['r1']);
  });

  it('excludes a request that is not yet expired', () => {
    const ids = findNewlyExpiredPendingRequestIds([req('r1', 'pending', '2026-08-19T00:00:00.000Z')], new Set(), now);
    expect(ids).toEqual([]);
  });

  it('excludes a paid request even if its expiry has passed', () => {
    const ids = findNewlyExpiredPendingRequestIds([req('r1', 'paid', '2026-08-18T11:00:00.000Z')], new Set(), now);
    expect(ids).toEqual([]);
  });

  it('excludes a confirming request -- a payment is already in flight, it is not meaningfully "expired"', () => {
    const ids = findNewlyExpiredPendingRequestIds([req('r1', 'confirming', '2026-08-18T11:00:00.000Z')], new Set(), now);
    expect(ids).toEqual([]);
  });

  it('excludes a cancelled request', () => {
    const ids = findNewlyExpiredPendingRequestIds([req('r1', 'cancelled', '2026-08-18T11:00:00.000Z')], new Set(), now);
    expect(ids).toEqual([]);
  });

  it('excludes an id already in the alreadyAttempted set -- never re-fires for the same request every poll (duplicate prevention)', () => {
    const ids = findNewlyExpiredPendingRequestIds(
      [req('r1', 'pending', '2026-08-18T11:00:00.000Z')],
      new Set(['r1']),
      now
    );
    expect(ids).toEqual([]);
  });

  it('returns only the newly-expired ones out of a mixed list', () => {
    const ids = findNewlyExpiredPendingRequestIds(
      [
        req('r1', 'pending', '2026-08-18T11:00:00.000Z'), // expired, new
        req('r2', 'pending', '2026-08-19T00:00:00.000Z'), // not expired
        req('r3', 'paid', '2026-08-18T11:00:00.000Z'), // paid
        req('r4', 'pending', '2026-08-17T00:00:00.000Z'), // expired, already attempted
      ],
      new Set(['r4']),
      now
    );
    expect(ids).toEqual(['r1']);
  });
});
