import { useCallback, useEffect, useState } from 'react';
import { fetchPublicCheckout } from './publicCheckoutService';
import type { PublicCheckoutData, PublicCheckoutResult } from './types';

export const DEFAULT_POLL_INTERVAL_MS = 7000;

export function isTerminalCheckoutStatus(status: PublicCheckoutData['status']): boolean {
  return status === 'paid' || status === 'expired' || status === 'cancelled';
}

interface UsePublicCheckoutPollingResult {
  result: PublicCheckoutResult | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/**
 * Polls fetchPublicCheckout via a self-rescheduling setTimeout (never
 * setInterval) so a slow response can never overlap with the next request.
 * Polling stops entirely once a result is a terminal status or an error --
 * error states are surfaced to the caller for a manual refresh instead.
 */
export function usePublicCheckoutPolling(
  token: string | undefined,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS
): UsePublicCheckoutPollingResult {
  const [result, setResult] = useState<PublicCheckoutResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!token) {
      setResult({ ok: false, code: 'invalid_token', message: 'This payment link is invalid.' });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      const next = await fetchPublicCheckout(token as string);
      if (cancelled) return;
      setResult(next);
      setIsRefreshing(false);
      if (next.ok && !isTerminalCheckoutStatus(next.data.status)) {
        timer = setTimeout(poll, pollIntervalMs);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, retryKey, pollIntervalMs]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setRetryKey((key) => key + 1);
  }, []);

  return { result, isRefreshing, refresh };
}
