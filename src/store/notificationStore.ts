import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationPreferences } from '../types';

interface NotificationState {
  preferences: NotificationPreferences;
  updatePreferences: (patch: Partial<NotificationPreferences>) => void;
}

const defaultPreferences: NotificationPreferences = {
  payments: true,
  requests: true,
  reminders: true,
  recurring: true,
  customers: true,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      updatePreferences: (patch) => set((state) => ({ preferences: { ...state.preferences, ...patch } })),
    }),
    {
      name: 'speropay/notifications',
      storage: createJSONStorage(() => AsyncStorage),
      // Phase 6C renamed this store's category keys (paymentReceived/
      // paymentDetected/requestExpired/requestReminder -> payments/requests/
      // reminders/recurring/customers). A device with the OLD persisted
      // shape must not have every new category silently read as `undefined`
      // (falsy -> every toggle would render OFF for a user who never
      // touched this screen) -- explicitly falling back to `true` per
      // category (this store's own default) for anything missing/renamed
      // is a one-line safety net cheaper than a full versioned migration
      // for what was already an all-on-by-default preference.
      merge: (persisted, current) => ({
        ...current,
        preferences: { ...defaultPreferences, ...(persisted as Partial<NotificationState>)?.preferences },
      }),
    }
  )
);
