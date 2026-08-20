import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { mapSupabaseUser } from '../utils/mapSupabaseUser';
import { getAuthErrorMessage } from '../utils/authErrors';
import { getAuthCallbackUrl } from '../utils/authDeepLink';

interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  error: string | null;
  isPasswordRecovery: boolean;
  sessionExpiredNotice: boolean;
  signUp: (fullName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  exchangeAuthCode: (code: string) => Promise<void>;
  clearPasswordRecovery: () => void;
  clearSessionExpiredNotice: () => void;
  clearError: () => void;
  _setSession: (session: Session | null) => void;
}

// Lets the auth-state listener tell an explicit signOut() apart from a
// SIGNED_OUT event the SDK fired on its own (refresh failure, revoked
// session) — only the latter should surface a "session expired" notice.
// Module-level and transient by design: it's not UI-bindable state.
let isExplicitSignOut = false;

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  hasHydrated: false,
  error: null,
  isPasswordRecovery: false,
  sessionExpiredNotice: false,

  signUp: async (fullName, email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: getAuthCallbackUrl() },
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
    isExplicitSignOut = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        set({ error: getAuthErrorMessage(error, 'sign-in') });
        throw error;
      }
    } finally {
      set({ isLoading: false, isPasswordRecovery: false });
      // Safety net: if Supabase's own SIGNED_OUT event never reaches our
      // listener for this call (e.g. it errored before emitting one), this
      // flag must not stay `true` and incorrectly suppress a *future*,
      // genuinely-unexpected session-expiry notice.
      isExplicitSignOut = false;
    }
  },

  sendPasswordReset: async (email) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getAuthCallbackUrl() });
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'reset-password') });
      throw error;
    }
    set({ isLoading: false });
  },

  updatePassword: async (password) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'update-password') });
      throw error;
    }
    set({ isLoading: false });
  },

  resendConfirmationEmail: async (email) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthCallbackUrl() },
    });
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-up') });
      throw error;
    }
    set({ isLoading: false });
  },

  exchangeAuthCode: async (code) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-in') });
      throw error;
    }
    set({ isLoading: false });
  },

  clearPasswordRecovery: () => set({ isPasswordRecovery: false }),
  clearSessionExpiredNotice: () => set({ sessionExpiredNotice: false }),
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

  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      useAuthStore.setState({ isPasswordRecovery: true });
    }

    if (event === 'SIGNED_OUT') {
      useAuthStore.setState({ sessionExpiredNotice: !isExplicitSignOut });
      isExplicitSignOut = false;
    }

    useAuthStore.getState()._setSession(session);
  });

  return () => listener.subscription.unsubscribe();
}
