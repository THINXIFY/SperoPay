import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchPublicReceipt } from './receiptService';
import type { PublicReceiptResult } from './types';

interface UsePublicReceiptResult {
  result: PublicReceiptResult | null;
  isRefreshing: boolean;
  refresh: () => void;
}

export function usePublicReceipt(token: string | undefined): UsePublicReceiptResult {
  const [result, setResult] = useState<PublicReceiptResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (isManualRefresh: boolean) => {
      if (!token) {
        setResult({ ok: false, code: 'invalid_token', message: 'This receipt link is invalid.' });
        return;
      }
      if (isManualRefresh) setIsRefreshing(true);
      const next = await fetchPublicReceipt(token);
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
