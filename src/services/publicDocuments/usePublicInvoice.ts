import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchPublicInvoice } from './invoiceService';
import type { PublicInvoiceResult } from './types';

interface UsePublicInvoiceResult {
  result: PublicInvoiceResult | null;
  isRefreshing: boolean;
  refresh: () => void;
}

// Same "no polling, refetch on focus + explicit pull-to-refresh" rule as
// useCustomerPortal -- an invoice document has nothing that needs
// sub-second freshness; a customer navigating back from checkout (where
// status actually changes) is what refetching on focus is for.
export function usePublicInvoice(token: string | undefined): UsePublicInvoiceResult {
  const [result, setResult] = useState<PublicInvoiceResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (isManualRefresh: boolean) => {
      if (!token) {
        setResult({ ok: false, code: 'invalid_token', message: 'This invoice link is invalid.' });
        return;
      }
      if (isManualRefresh) setIsRefreshing(true);
      const next = await fetchPublicInvoice(token);
      setResult(next);
      setIsRefreshing(false);
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])
  );

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return { result, isRefreshing, refresh };
}
