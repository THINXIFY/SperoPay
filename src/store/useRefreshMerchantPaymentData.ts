import { useCallback, useRef, useState } from 'react';
import { useAuthStore } from './authStore';
import { useRequestStore } from './requestStore';
import { useTransactionStore } from './transactionStore';
import { useRequestEventStore } from './requestEventStore';
import { useNotificationsFeedStore } from './notificationsFeedStore';

interface UseRefreshMerchantPaymentDataResult {
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

// A real Solana payment is verified and written entirely server-side (the
// verify-payment Edge Function, using the service-role key) -- outside the
// merchant's own session. Nothing pushes that change back to this app;
// loadForUser() only ever runs once, at sign-in (app/_layout.tsx). Without
// an explicit re-fetch, Request Detail/Requests/Home would show a payment
// as still pending indefinitely, until the merchant manually signs out and
// back in. This hook is the merchant-side fix: re-fetch requests,
// transactions, and their timeline events together, so a merchant
// screen can refresh (via pull-to-refresh, screen focus, or both) without
// requiring an app restart. Home/Customer Detail/Invoice/Receipt need no
// separate fix -- they already derive reactively from these same stores.
export function useRefreshMerchantPaymentData(): UseRefreshMerchantPaymentDataResult {
  const userId = useAuthStore((state) => state.user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // A screen can wire this up to both a focus effect and pull-to-refresh --
  // without this guard, triggering the second while the first is still in
  // flight would fire a duplicate set of Supabase reads, and whichever call
  // finished first would flip isRefreshing off while the other was still
  // running.
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId || inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRefreshing(true);
    try {
      await Promise.all([
        useRequestStore.getState().loadForUser(userId),
        useTransactionStore.getState().loadForUser(userId),
        useRequestEventStore.getState().loadForUser(userId),
        useNotificationsFeedStore.getState().loadForUser(userId),
      ]);
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [userId]);

  return { refresh, isRefreshing };
}
