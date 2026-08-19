import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExpiryOption } from '../types';

interface PaymentDefaultsState {
  defaultExpiryOption: ExpiryOption;
  setDefaultExpiryOption: (option: ExpiryOption) => void;
}

export const usePaymentDefaultsStore = create<PaymentDefaultsState>()(
  persist(
    (set) => ({
      defaultExpiryOption: '7d',
      setDefaultExpiryOption: (defaultExpiryOption) => set({ defaultExpiryOption }),
    }),
    { name: 'speropay/paymentDefaults', storage: createJSONStorage(() => AsyncStorage) }
  )
);
