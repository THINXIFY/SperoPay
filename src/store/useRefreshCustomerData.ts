import { useCallback, useRef, useState } from 'react';
import { useAuthStore } from './authStore';
import { useCustomerStore } from './customerStore';
import { useRequestStore } from './requestStore';
import { useTransactionStore } from './transactionStore';

interface UseRefreshCustomerDataResult {
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

// Same shape and guarding as useRefreshMerchantPaymentData, for the
// Customers screens: customers themselves (a customer edited elsewhere
// won't otherwise reach this session), plus requests and transactions --
// getCustomerStats and Customer Detail's history date labels both derive
// from those, not just the customer record itself.
export function useRefreshCustomerData(): UseRefreshCustomerDataResult {
  const userId = useAuthStore((state) => state.user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId || inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRefreshing(true);
    try {
      await Promise.all([
        useCustomerStore.getState().loadForUser(userId),
        useRequestStore.getState().loadForUser(userId),
        useTransactionStore.getState().loadForUser(userId),
      ]);
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [userId]);

  return { refresh, isRefreshing };
}
