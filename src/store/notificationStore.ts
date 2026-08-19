import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationPreferences } from '../types';

interface NotificationState {
  preferences: NotificationPreferences;
  updatePreferences: (patch: Partial<NotificationPreferences>) => void;
}

const defaultPreferences: NotificationPreferences = {
  paymentReceived: true,
  paymentDetected: true,
  requestExpired: true,
  requestReminder: true,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      updatePreferences: (patch) => set((state) => ({ preferences: { ...state.preferences, ...patch } })),
    }),
    { name: 'speropay/notifications', storage: createJSONStorage(() => AsyncStorage) }
  )
);
