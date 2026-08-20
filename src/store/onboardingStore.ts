import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './authStore';

interface OnboardingState {
  completedUserIds: string[];
  hasHydrated: boolean;
  completeOnboarding: (userId: string) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completedUserIds: [],
      hasHydrated: false,
      completeOnboarding: (userId) =>
        set((state) =>
          state.completedUserIds.includes(userId)
            ? state
            : { completedUserIds: [...state.completedUserIds, userId] }
        ),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'speropay/onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate onboarding store', error);
        }
        // Read from the store directly rather than relying on `state` so the
        // flag is still flipped even if rehydration errored out.
        useOnboardingStore.getState().setHasHydrated(true);
      },
    }
  )
);

export function isOnboardingComplete(userId: string | undefined, completedUserIds: string[]): boolean {
  return !!userId && completedUserIds.includes(userId);
}

// The one place routing/screens should read onboarding completion from —
// replaces the old global `hasCompletedOnboarding` boolean, which didn't
// distinguish between users on the same device.
export function useHasCompletedOnboarding(): boolean {
  const userId = useAuthStore((state) => state.user?.id);
  const completedUserIds = useOnboardingStore((state) => state.completedUserIds);
  return isOnboardingComplete(userId, completedUserIds);
}
