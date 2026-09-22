import type { ExpiryOption } from '../types';

const HOUR_MS = 60 * 60 * 1000;

export function calculateExpiresAt(option: ExpiryOption, now: Date = new Date()): string | null {
  switch (option) {
    case '1h':
      return new Date(now.getTime() + HOUR_MS).toISOString();
    case '24h':
      return new Date(now.getTime() + 24 * HOUR_MS).toISOString();
    case '7d':
      return new Date(now.getTime() + 7 * 24 * HOUR_MS).toISOString();
    case 'never':
      return null;
  }
}

export function isRequestExpired(request: { expiresAt: string | null }, now: Date = new Date()): boolean {
  return request.expiresAt !== null && new Date(request.expiresAt).getTime() <= now.getTime();
}

// Phase 6C: the pure "which requests need a record_request_expired_notification
// call" decision, extracted out of app/(app)/requests/index.tsx's own effect
// so it's directly unit-testable without rendering that screen. Only ever a
// TRIGGER -- record_request_expired_notification re-derives real expiry from
// expires_at itself server-side before recording anything, this never
// decides on its own that a notification should exist.
export function findNewlyExpiredPendingRequestIds<T extends { id: string; status: string; expiresAt: string | null }>(
  requests: T[],
  alreadyAttempted: ReadonlySet<string>,
  now: Date = new Date()
): string[] {
  return requests.filter((r) => r.status === 'pending' && isRequestExpired(r, now) && !alreadyAttempted.has(r.id)).map((r) => r.id);
}
