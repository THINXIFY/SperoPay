import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePreference } from '../types';

interface ThemeState {
  preference: ThemePreference | null;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: null,
      setPreference: (preference) => set({ preference }),
    }),
    { name: 'speropay/theme', storage: createJSONStorage(() => AsyncStorage) }
  )
);
