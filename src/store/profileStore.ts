import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile, UsageType } from '../types';

interface ProfileState {
  profile: Profile;
  setUsageType: (usageType: UsageType) => void;
  updateProfile: (patch: Partial<Omit<Profile, 'usageType'>>) => void;
}

const emptyProfile: Profile = {
  usageType: null,
  displayName: '',
  businessName: undefined,
  country: '',
  website: undefined,
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: emptyProfile,
      setUsageType: (usageType) => set((state) => ({ profile: { ...state.profile, usageType } })),
      updateProfile: (patch) => set((state) => ({ profile: { ...state.profile, ...patch } })),
    }),
    { name: 'speropay/profile', storage: createJSONStorage(() => AsyncStorage) }
  )
);
