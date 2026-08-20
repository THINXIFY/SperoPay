import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { mapSupabaseUser } from '../utils/mapSupabaseUser';
import { getAuthErrorMessage } from '../utils/authErrors';

interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  error: string | null;
  signUp: (fullName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  clearError: () => void;
  _setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  hasHydrated: false,
  error: null,

  signUp: async (fullName, email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-up') });
      throw error;
    }
    set({ isLoading: false });
    return { needsEmailConfirmation: !data.session };
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-in') });
      throw error;
    }
    set({ isLoading: false });
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        set({ error: getAuthErrorMessage(error, 'sign-in') });
        throw error;
      }
    } finally {
      set({ isLoading: false });
    }
  },

  sendPasswordReset: async (email) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-in') });
      throw error;
    }
    set({ isLoading: false });
  },

  clearError: () => set({ error: null }),

  _setSession: (session) => {
    set({
      session,
      user: session ? mapSupabaseUser(session.user) : null,
      isAuthenticated: !!session,
      hasHydrated: true,
    });
  },
}));

/**
 * Wires the store to Supabase's actual session state: one immediate read via
 * getSession() (whatever Supabase already restored from its own persistence),
 * then a continuous subscription for the app's lifetime. Both paths funnel
 * through _setSession, so there is exactly one place that ever writes session/
 * user/isAuthenticated/hasHydrated. Call once from the root layout; the
 * returned function unsubscribes.
 */
export function initializeAuthListener(): () => void {
  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      useAuthStore.getState()._setSession(session);
    })
    .catch(() => {
      // A rejected getSession() (e.g. a storage read failure) must not leave
      // hasHydrated stuck false forever — fall back to a signed-out session so
      // AuthGate/splash routing can still proceed.
      useAuthStore.getState()._setSession(null);
    });

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState()._setSession(session);
  });

  return () => listener.subscription.unsubscribe();
}
