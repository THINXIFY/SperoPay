import { useCallback, useRef, useState } from 'react';
import { useAuthStore } from './authStore';
import { useTemplateStore } from './templateStore';

interface UseRefreshTemplateDataResult {
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

// Same shape/guarding as useRefreshCustomerData -- templates don't depend on
// any other store's data for display, so this only reloads themselves.
export function useRefreshTemplateData(): UseRefreshTemplateDataResult {
  const userId = useAuthStore((state) => state.user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId || inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRefreshing(true);
    try {
      await useTemplateStore.getState().loadForUser(userId);
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [userId]);

  return { refresh, isRefreshing };
}
