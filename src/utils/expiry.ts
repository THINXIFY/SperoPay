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
