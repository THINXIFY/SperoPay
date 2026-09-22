import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchCustomerPortal } from './customerPortalService';
import type { CustomerPortalResult } from './types';

interface UseCustomerPortalResult {
  result: CustomerPortalResult | null;
  isRefreshing: boolean;
  refresh: () => void;
}

// Deliberately NOT a polling loop (spec: "do not introduce aggressive
// continuous polling"). A payment's own live status updates already happen
// on the existing public checkout page (/p/<token>), which "Pay now" sends
// the customer to and which already polls/verifies correctly on its own --
// this hook only needs to pick up whatever that flow decided, which it
// does by refetching whenever the portal screen regains focus (the
// customer navigating back from checkout) plus an explicit pull-to-refresh,
// never on a timer.
export function useCustomerPortal(token: string | undefined): UseCustomerPortalResult {
  const [result, setResult] = useState<CustomerPortalResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (isManualRefresh: boolean) => {
      if (!token) {
        setResult({ ok: false, code: 'invalid_token', message: 'The link is malformed or incomplete.' });
        return;
      }
      if (isManualRefresh) setIsRefreshing(true);
      const next = await fetchCustomerPortal(token);
      setResult(next);
      setIsRefreshing(false);
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
      // Only a real focus event or a token change should trigger a fetch --
      // load's identity changes on every token change already, so this
      // dependency array intentionally tracks `token` directly rather than
      // `load` itself.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])
  );

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return { result, isRefreshing, refresh };
}
