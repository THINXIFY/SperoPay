import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { mapSupabaseUser } from '../utils/mapSupabaseUser';
import { getAuthErrorMessage, isEmailNotConfirmedError } from '../utils/authErrors';
import { getAuthCallbackUrl } from '../utils/authDeepLink';
import { authDebugLog } from '../utils/authDebugLog';

export interface SignUpResult {
  // A real confirmation email was sent -- either a brand-new signup, or a
  // re-attempt against an email that already has an UNCONFIRMED account
  // (Supabase resends in that case, rather than erroring, so a user who
  // lost the first email can just sign up again to get another).
  needsEmailConfirmation: boolean;
  // Supabase's documented signal for "this email already has a CONFIRMED
  // account": signUp() returns success (no `error`), no session, AND an
  // empty `identities` array -- deliberately indistinguishable from a
  // real send at the network level, to avoid leaking account existence to
  // an attacker. From this app's own perspective, though, it means NO
  // email was actually sent, and showing "Check your email" here would be
  // a real, silent lie -- this is the specific case that previously made
  // "sign up again with an email already used during testing" look like a
  // successful signup with a confirmation email that would never arrive.
  alreadyRegistered: boolean;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  error: string | null;
  // Structured, not string-matched from `error`'s display text -- see
  // isEmailNotConfirmedError in authErrors.ts.
  isEmailNotConfirmed: boolean;
  isPasswordRecovery: boolean;
  sessionExpiredNotice: boolean;
  signUp: (fullName: string, email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  exchangeAuthCode: (code: string, flowId?: string) => Promise<void>;
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
  isEmailNotConfirmed: false,
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
      authDebugLog('signUp error', { name: error.name, message: error.message });
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-up') });
      throw error;
    }
    const identityCount = data.user?.identities?.length ?? 0;
    // Supabase's anti-enumeration behavior: an email that already has a
    // CONFIRMED account returns success with no session and an empty
    // identities array, and sends no email at all. A brand-new email, or
    // one with an existing UNCONFIRMED account, returns a non-empty
    // identities array and Supabase does send (or resend) a real email.
    const alreadyRegistered = !data.session && identityCount === 0;
    authDebugLog('signUp success', {
      hasSession: !!data.session,
      hasUser: !!data.user,
      emailConfirmedAt: data.user?.email_confirmed_at ?? null,
      identityCount,
      alreadyRegistered,
    });
    set({ isLoading: false });
    return { needsEmailConfirmation: !data.session && !alreadyRegistered, alreadyRegistered };
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null, isEmailNotConfirmed: false });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const emailNotConfirmed = isEmailNotConfirmedError(error);
      authDebugLog('signIn error', { name: error.name, message: error.message, emailNotConfirmed });
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-in'), isEmailNotConfirmed: emailNotConfirmed });
      throw error;
    }
    authDebugLog('signIn success', {});
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
      // Only clear on a *confirmed* success — a failed call (e.g. offline)
      // leaves the real session live, and clearing this unconditionally
      // would make that still-live recovery session look like an ordinary
      // authenticated one to AuthGate, granting full app access with the
      // old password still valid.
      set({ isPasswordRecovery: false });
    } finally {
      set({ isLoading: false });
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
      authDebugLog('resend error', { name: error.name, message: error.message });
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-up') });
      throw error;
    }
    authDebugLog('resend success', {});
    set({ isLoading: false });
  },

  exchangeAuthCode: async (code, flowId) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) {
      authDebugLog('exchangeAuthCode error', { name: error.name, message: error.message });
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-in') });
      throw error;
    }
    authDebugLog('exchangeAuthCode success', {});
    set({ isLoading: false });
  },

  clearPasswordRecovery: () => set({ isPasswordRecovery: false }),
  clearSessionExpiredNotice: () => set({ sessionExpiredNotice: false }),
  clearError: () => set({ error: null, isEmailNotConfirmed: false }),

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
