import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SecurityState {
  biometricLockEnabled: boolean;
  appLockEnabled: boolean;
  setBiometricLockEnabled: (value: boolean) => void;
  setAppLockEnabled: (value: boolean) => void;
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set) => ({
      biometricLockEnabled: false,
      appLockEnabled: false,
      setBiometricLockEnabled: (biometricLockEnabled) => set({ biometricLockEnabled }),
      setAppLockEnabled: (appLockEnabled) => set({ appLockEnabled }),
    }),
    { name: 'speropay/security', storage: createJSONStorage(() => AsyncStorage) }
  )
);
