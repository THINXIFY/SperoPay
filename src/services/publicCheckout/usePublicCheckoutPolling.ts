import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPublicCheckout } from './publicCheckoutService';
import { triggerPaymentVerification } from './verifyPayment';
import type { PublicCheckoutData, PublicCheckoutResult } from './types';

export const DEFAULT_POLL_INTERVAL_MS = 7000;

export function isTerminalCheckoutStatus(status: PublicCheckoutData['status']): boolean {
  return status === 'paid' || status === 'expired' || status === 'cancelled';
}

interface UsePublicCheckoutPollingResult {
  result: PublicCheckoutResult | null;
  /** True once a poll has failed with a network error *after* we already had good data -- the last good `result` is kept on screen rather than being replaced by an error state. */
  isOffline: boolean;
  isRefreshing: boolean;
  refresh: () => void;
}

/**
 * Polls fetchPublicCheckout via a self-rescheduling setTimeout (never
 * setInterval) so a slow response can never overlap with the next request.
 * Polling stops entirely once a result is a terminal status or an error --
 * error states are surfaced to the caller for a manual refresh instead.
 * Each tick also nudges the server-side verify-payment Edge Function first
 * (best-effort) so a real, independently-verified status change shows up
 * on this same tick's fetch rather than waiting for the next one.
 *
 * A transient network failure on a *later* tick (after the first
 * successful load) never resets the screen back to an error state --
 * `result` keeps the last known-good data and `isOffline` flips true
 * instead, so the payer's view doesn't flash between content and an error
 * screen on an ordinary connectivity blip. Polling keeps retrying in the
 * background; the first success after that clears `isOffline` again.
 */
export function usePublicCheckoutPolling(
  token: string | undefined,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS
): UsePublicCheckoutPollingResult {
  const [result, setResult] = useState<PublicCheckoutResult | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // Persists across the effect's own restarts (token/retryKey changes) --
  // guards against a manual refresh() or a foreground-return nudge firing
  // the verification trigger again while a previous tick's own trigger
  // call is still in flight (spec: "one verification request at a time").
  const verifyInFlightRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setResult({ ok: false, code: 'invalid_token', message: 'This payment link is invalid.' });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hasLoadedOnce = false;

    async function poll() {
      if (!verifyInFlightRef.current) {
        verifyInFlightRef.current = true;
        // Best-effort, never awaited-for-correctness: a real backend check
        // happens here, but whatever it decided is only ever observed
        // through the fetchPublicCheckout call below, on this tick or a
        // later one -- this call never sets state itself.
        await triggerPaymentVerification(token as string);
        verifyInFlightRef.current = false;
      }
      if (cancelled) return;

      const next = await fetchPublicCheckout(token as string);
      if (cancelled) return;

      if (!next.ok && next.code === 'network_error' && hasLoadedOnce) {
        // We already have something good on screen -- a transient blip
        // must not blank it out. Keep the last result, flag the outage,
        // and keep trying on the same schedule (only ever reachable here
        // because the previous successful status was non-terminal, so
        // continuing to poll is still correct).
        setIsOffline(true);
        setIsRefreshing(false);
        timer = setTimeout(poll, pollIntervalMs);
        return;
      }

      setIsOffline(false);
      setResult(next);
      setIsRefreshing(false);
      if (next.ok) {
        hasLoadedOnce = true;
        if (!isTerminalCheckoutStatus(next.data.status)) {
          timer = setTimeout(poll, pollIntervalMs);
        }
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

  return { result, isOffline, isRefreshing, refresh };
}
