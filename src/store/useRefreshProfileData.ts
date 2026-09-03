import { useCallback, useRef, useState } from 'react';
import { useAuthStore } from './authStore';
import { useProfileStore } from './profileStore';
import { useWalletStore } from './walletStore';

interface UseRefreshProfileDataResult {
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

// Same shape and guarding as useRefreshMerchantPaymentData, for the
// Profile screen: profile and receiving-wallet settings, which can change
// from another device/session and otherwise only reload at sign-in.
export function useRefreshProfileData(): UseRefreshProfileDataResult {
  const userId = useAuthStore((state) => state.user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId || inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRefreshing(true);
    try {
      await Promise.all([useProfileStore.getState().loadForUser(userId), useWalletStore.getState().loadForUser(userId)]);
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [userId]);

  return { refresh, isRefreshing };
}
