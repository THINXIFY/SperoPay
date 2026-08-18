import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';
import { generateId } from '../utils/ids';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hasHydrated: boolean;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => void;
  setHasHydrated: (value: boolean) => void;
}

function mockDelay(ms = 900) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: false,

      signUp: async (fullName, email, _password) => {
        set({ isLoading: true, error: null });
        await mockDelay();
        set({
          user: { id: generateId(), fullName, email, createdAt: new Date().toISOString() },
          isAuthenticated: true,
          isLoading: false,
        });
      },

      signIn: async (email, _password) => {
        set({ isLoading: true, error: null });
        await mockDelay();
        set({
          user: { id: generateId(), fullName: 'Farhan Z.', email, createdAt: new Date().toISOString() },
          isAuthenticated: true,
          isLoading: false,
        });
      },

      sendPasswordReset: async (_email) => {
        set({ isLoading: true, error: null });
        await mockDelay();
        set({ isLoading: false });
      },

      signOut: () => set({ user: null, isAuthenticated: false }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'thinxpay/auth',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate auth store', error);
        }
        // Read from the store directly rather than relying on `state` so the
        // flag is still flipped even if rehydration errored out.
        useAuthStore.getState().setHasHydrated(true);
      },
    }
  )
);
