import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { createStaleGuard } from './staleGuard';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Profile, UsageType } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface ProfileState {
  profile: Profile | null;
  status: Status;
  error: string | null;
  loadForUser: (userId: string, fallbackFullName?: string) => Promise<void>;
  updateProfile: (userId: string, patch: Partial<Omit<Profile, 'usageType' | 'onboardingCompleted'>>) => Promise<void>;
  setUsageType: (userId: string, usageType: UsageType) => Promise<void>;
  completeOnboarding: (userId: string) => Promise<void>;
  reset: () => void;
}

function mergeProfileRows(
  profileRow: {
    display_name: string;
    country: string;
    usage_type: string | null;
    avatar_url: string | null;
    onboarding_completed: boolean;
  },
  businessRow: {
    business_name: string | null;
    business_email: string | null;
    website: string | null;
    description: string | null;
    logo_url: string | null;
  } | null
): Profile {
  return {
    usageType: (profileRow.usage_type as UsageType | null) ?? null,
    displayName: profileRow.display_name,
    country: profileRow.country,
    avatarUri: profileRow.avatar_url ?? undefined,
    onboardingCompleted: profileRow.onboarding_completed,
    businessName: businessRow?.business_name ?? undefined,
    businessEmail: businessRow?.business_email ?? undefined,
    website: businessRow?.website ?? undefined,
    businessDescription: businessRow?.description ?? undefined,
    businessLogoUri: businessRow?.logo_url ?? undefined,
  };
}

// Guards loadForUser() against overwriting fresher state — a stalled
// response from a previous user's session, or one that resolves after a
// local mutation already ran — see staleGuard.ts.
const guard = createStaleGuard();

export const useProfileStore = create<ProfileState>()((set, get) => ({
  profile: null,
  status: 'idle',
  error: null,

  loadForUser: async (userId, fallbackFullName) => {
    const token = guard.next();
    set({ status: 'loading', error: null });
    try {
      let { data: profileRow, error: selectError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (selectError) throw selectError;
      if (!profileRow) {
        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, display_name: fallbackFullName ?? '' })
          .select('*')
          .single();
        if (insertError) throw insertError;
        profileRow = created;
      }

      const { data: businessRow } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!guard.isCurrent(token)) return;
      set({ profile: mergeProfileRows(profileRow, businessRow ?? null), status: 'loaded' });
    } catch (error) {
      if (!guard.isCurrent(token)) return;
      set({ status: 'error', error: getDataErrorMessage(error, 'profile') });
    }
  },

  updateProfile: async (userId, patch) => {
    guard.next(); // invalidate any in-flight load — this write must win
    const personalPatch: Record<string, unknown> = {};
    const businessPatch: Record<string, unknown> = {};

    if ('displayName' in patch) personalPatch.display_name = patch.displayName;
    if ('country' in patch) personalPatch.country = patch.country;
    if ('avatarUri' in patch) personalPatch.avatar_url = patch.avatarUri ?? null;
    if ('businessName' in patch) businessPatch.business_name = patch.businessName ?? null;
    if ('businessEmail' in patch) businessPatch.business_email = patch.businessEmail ?? null;
    if ('website' in patch) businessPatch.website = patch.website ?? null;
    if ('businessDescription' in patch) businessPatch.description = patch.businessDescription ?? null;
    if ('businessLogoUri' in patch) businessPatch.logo_url = patch.businessLogoUri ?? null;

    try {
      if (Object.keys(personalPatch).length > 0) {
        const { error } = await supabase.from('profiles').update(personalPatch).eq('id', userId);
        if (error) throw error;
      }
      if (Object.keys(businessPatch).length > 0) {
        const { error } = await supabase
          .from('business_profiles')
          .upsert({ user_id: userId, ...businessPatch }, { onConflict: 'user_id' });
        if (error) throw error;
      }

      const current = get().profile;
      if (current) {
        set({ profile: { ...current, ...patch } });
      }
    } catch (error) {
      set({ error: getDataErrorMessage(error, 'profile', 'save') });
      throw error;
    }
  },

  setUsageType: async (userId, usageType) => {
    guard.next();
    const { error } = await supabase.from('profiles').update({ usage_type: usageType }).eq('id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'profile', 'save') });
      throw error;
    }
    const current = get().profile;
    if (current) set({ profile: { ...current, usageType } });
  },

  completeOnboarding: async (userId) => {
    guard.next();
    const { error } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'profile', 'save') });
      throw error;
    }
    const current = get().profile;
    if (current) set({ profile: { ...current, onboardingCompleted: true } });
  },

  reset: () => {
    guard.next();
    set({ profile: null, status: 'idle', error: null });
  },
}));

registerResettable(() => useProfileStore.getState().reset());
