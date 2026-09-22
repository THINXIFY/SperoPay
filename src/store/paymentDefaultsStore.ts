import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExpiryOption } from '../types';
import { DEFAULT_ASSET, type AssetSymbol } from '../config/assets';

interface PaymentDefaultsState {
  defaultExpiryOption: ExpiryOption;
  setDefaultExpiryOption: (option: ExpiryOption) => void;
  // Phase 7: applies only to NEW requests (Smart Request prefills this,
  // the merchant can still change it per-request) -- changing it here
  // never rewrites any existing request's own stored currency. See
  // src/types/payment.ts's own comment on PaymentRequest.currency.
  defaultCurrency: AssetSymbol;
  setDefaultCurrency: (currency: AssetSymbol) => void;
}

export const usePaymentDefaultsStore = create<PaymentDefaultsState>()(
  persist(
    (set) => ({
      defaultExpiryOption: '7d',
      setDefaultExpiryOption: (defaultExpiryOption) => set({ defaultExpiryOption }),
      defaultCurrency: DEFAULT_ASSET,
      setDefaultCurrency: (defaultCurrency) => set({ defaultCurrency }),
    }),
    { name: 'speropay/paymentDefaults', storage: createJSONStorage(() => AsyncStorage) }
  )
);
