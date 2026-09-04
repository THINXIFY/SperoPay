jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      resend: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

jest.mock('../../utils/authDeepLink', () => ({
  getAuthCallbackUrl: () => 'speropay://auth/callback',
}));

import { supabase } from '../../lib/supabase';
import { useAuthStore, initializeAuthListener } from '../authStore';

// jest.Mocked<T> is shallow — it would leave `auth`'s methods typed as plain
// functions with no mockResolvedValue. jest.mocked() (no options) is deep.
const mockedSupabase = jest.mocked(supabase);

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email: 'jane@example.com',
      user_metadata: { full_name: 'Jane Doe' },
      created_at: '2026-08-20T00:00:00.000Z',
      app_metadata: {},
      aud: 'authenticated',
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    session: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    hasHydrated: false,
    error: null,
    isEmailNotConfirmed: false,
    isPasswordRecovery: false,
    sessionExpiredNotice: false,
  });
});

describe('signIn', () => {
  it('calls signInWithPassword and clears loading/error on success', async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().signIn('jane@example.com', 'password123');

    expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'password123',
    });
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('sets a human-friendly error and rethrows on failure', async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error('Invalid login credentials'),
    } as never);

    await expect(useAuthStore.getState().signIn('jane@example.com', 'wrong')).rejects.toThrow();
    expect(useAuthStore.getState().error).toBe('Email or password is incorrect.');
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().isEmailNotConfirmed).toBe(false);
  });

  it('sets isEmailNotConfirmed when Supabase reports an unconfirmed email, distinct from wrong credentials', async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error('Email not confirmed'),
    } as never);

    await expect(useAuthStore.getState().signIn('jane@example.com', 'password123')).rejects.toThrow();
    expect(useAuthStore.getState().isEmailNotConfirmed).toBe(true);
  });

  it('clears a stale isEmailNotConfirmed flag from a previous attempt on a fresh call', async () => {
    useAuthStore.setState({ isEmailNotConfirmed: true });
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().signIn('jane@example.com', 'password123');

    expect(useAuthStore.getState().isEmailNotConfirmed).toBe(false);
  });
});

describe('signUp', () => {
  it('reports needsEmailConfirmation: false, alreadyRegistered: false when a session is returned', async () => {
    const session = makeSession();
    mockedSupabase.auth.signUp.mockResolvedValue({ data: { session, user: session.user }, error: null } as never);

    const result = await useAuthStore.getState().signUp('Jane Doe', 'jane@example.com', 'password123');

    expect(result).toEqual({ needsEmailConfirmation: false, alreadyRegistered: false });
    expect(mockedSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'password123',
      options: { data: { full_name: 'Jane Doe' }, emailRedirectTo: 'speropay://auth/callback' },
    });
  });

  it('reports needsEmailConfirmation: true for a brand-new signup (no session, one identity)', async () => {
    const session = makeSession();
    const user = { ...session.user, identities: [{ id: 'identity-1' }] };
    mockedSupabase.auth.signUp.mockResolvedValue({ data: { session: null, user }, error: null } as never);

    const result = await useAuthStore.getState().signUp('Jane Doe', 'jane@example.com', 'password123');

    expect(result).toEqual({ needsEmailConfirmation: true, alreadyRegistered: false });
  });

  it('reports needsEmailConfirmation: true for a re-signup against an existing UNCONFIRMED account (Supabase resends)', async () => {
    const session = makeSession();
    const user = { ...session.user, identities: [{ id: 'identity-1' }] };
    mockedSupabase.auth.signUp.mockResolvedValue({ data: { session: null, user }, error: null } as never);

    const result = await useAuthStore.getState().signUp('Jane Doe', 'jane@example.com', 'password123');

    expect(result.needsEmailConfirmation).toBe(true);
  });

  it('reports alreadyRegistered: true (and needsEmailConfirmation: false) for an existing CONFIRMED account -- Supabase sends no email in this case', async () => {
    const session = makeSession();
    const user = { ...session.user, identities: [] };
    mockedSupabase.auth.signUp.mockResolvedValue({ data: { session: null, user }, error: null } as never);

    const result = await useAuthStore.getState().signUp('Jane Doe', 'jane@example.com', 'password123');

    expect(result).toEqual({ needsEmailConfirmation: false, alreadyRegistered: true });
  });

  it('sets a human-friendly error and rethrows on failure', async () => {
    mockedSupabase.auth.signUp.mockResolvedValue({
      data: {},
      error: new Error('User already registered'),
    } as never);

    await expect(useAuthStore.getState().signUp('Jane Doe', 'jane@example.com', 'password123')).rejects.toThrow();
    expect(useAuthStore.getState().error).toBe('An account already exists with this email.');
  });
});

describe('signOut', () => {
  it('calls supabase.auth.signOut and clears loading', async () => {
    mockedSupabase.auth.signOut.mockResolvedValue({ error: null } as never);

    await useAuthStore.getState().signOut();

    expect(mockedSupabase.auth.signOut).toHaveBeenCalled();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('sets a human-friendly error and rethrows when Supabase returns an error', async () => {
    mockedSupabase.auth.signOut.mockResolvedValue({ error: new Error('Network error') } as never);

    await expect(useAuthStore.getState().signOut()).rejects.toThrow();
    expect(useAuthStore.getState().error).not.toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('still clears loading if supabase.auth.signOut rejects outright', async () => {
    mockedSupabase.auth.signOut.mockRejectedValue(new Error('lock timeout'));

    await expect(useAuthStore.getState().signOut()).rejects.toThrow();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

describe('sendPasswordReset', () => {
  it('passes the centralized callback URL as redirectTo', async () => {
    mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().sendPasswordReset('jane@example.com');

    expect(mockedSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('auth/callback') })
    );
  });
});

describe('updatePassword', () => {
  it('calls updateUser with the new password and clears loading on success', async () => {
    mockedSupabase.auth.updateUser.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().updatePassword('newpassword123');

    expect(mockedSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword123' });
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('sets a human-friendly error and rethrows on failure', async () => {
    mockedSupabase.auth.updateUser.mockResolvedValue({ data: {}, error: new Error('weird failure') } as never);

    await expect(useAuthStore.getState().updatePassword('newpassword123')).rejects.toThrow();
    expect(useAuthStore.getState().error).toBe("We couldn't update your password right now. Please try again.");
  });
});

describe('resendConfirmationEmail', () => {
  it('calls resend with type signup and the centralized callback URL', async () => {
    mockedSupabase.auth.resend.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().resendConfirmationEmail('jane@example.com');

    expect(mockedSupabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'jane@example.com',
      options: { emailRedirectTo: expect.stringContaining('auth/callback') },
    });
  });
});

describe('exchangeAuthCode', () => {
  it('calls exchangeCodeForSession and clears loading on success', async () => {
    mockedSupabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().exchangeAuthCode('the-code');

    expect(mockedSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('the-code', undefined);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('passes a flowId through when provided (matches a specific PKCE verifier instead of the legacy single-slot fallback)', async () => {
    mockedSupabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().exchangeAuthCode('the-code', 'flow-123');

    expect(mockedSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('the-code', { flowId: 'flow-123' });
  });

  it('sets an invalid-link error and rethrows on failure', async () => {
    const pkceError = new Error('No code detected.');
    pkceError.name = 'AuthPKCEGrantCodeExchangeError';
    mockedSupabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: pkceError } as never);

    await expect(useAuthStore.getState().exchangeAuthCode('bad-code')).rejects.toThrow();
    expect(useAuthStore.getState().error).toBe(
      'This link is no longer valid. Request a new one and open it on this device.'
    );
  });
});

describe('password recovery state', () => {
  it('sets isPasswordRecovery when onAuthStateChange reports PASSWORD_RECOVERY', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null } } as never);
    let capturedCallback: ((event: string, session: unknown) => void) | undefined;
    mockedSupabase.auth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb as never;
      return { data: { subscription: { unsubscribe: jest.fn() } } } as never;
    });

    initializeAuthListener();
    capturedCallback?.('PASSWORD_RECOVERY', makeSession());

    expect(useAuthStore.getState().isPasswordRecovery).toBe(true);
  });

  it('clearPasswordRecovery resets the flag', () => {
    useAuthStore.setState({ isPasswordRecovery: true });
    useAuthStore.getState().clearPasswordRecovery();
    expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
  });

  it('signOut clears isPasswordRecovery on confirmed success', async () => {
    useAuthStore.setState({ isPasswordRecovery: true });
    mockedSupabase.auth.signOut.mockResolvedValue({ error: null } as never);

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
  });

  it('does NOT clear isPasswordRecovery when signOut fails (e.g. offline) — the session is still live', async () => {
    useAuthStore.setState({ isPasswordRecovery: true });
    mockedSupabase.auth.signOut.mockRejectedValue(new Error('Network request failed'));

    await expect(useAuthStore.getState().signOut()).rejects.toThrow();

    expect(useAuthStore.getState().isPasswordRecovery).toBe(true);
  });
});

describe('sessionExpiredNotice', () => {
  it('is set when the SDK reports SIGNED_OUT without our own signOut() having been called', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null } } as never);
    let capturedCallback: ((event: string, session: unknown) => void) | undefined;
    mockedSupabase.auth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb as never;
      return { data: { subscription: { unsubscribe: jest.fn() } } } as never;
    });

    initializeAuthListener();
    capturedCallback?.('SIGNED_OUT', null);

    expect(useAuthStore.getState().sessionExpiredNotice).toBe(true);
  });

  it('is NOT set when SIGNED_OUT follows our own explicit signOut()', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null } } as never);
    let capturedCallback: ((event: string, session: unknown) => void) | undefined;
    mockedSupabase.auth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb as never;
      return { data: { subscription: { unsubscribe: jest.fn() } } } as never;
    });
    mockedSupabase.auth.signOut.mockImplementation(async () => {
      capturedCallback?.('SIGNED_OUT', null);
      return { error: null } as never;
    });

    initializeAuthListener();
    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().sessionExpiredNotice).toBe(false);
  });

  it('clearSessionExpiredNotice resets the flag', () => {
    useAuthStore.setState({ sessionExpiredNotice: true });
    useAuthStore.getState().clearSessionExpiredNotice();
    expect(useAuthStore.getState().sessionExpiredNotice).toBe(false);
  });
});

describe('_setSession', () => {
  it('populates user/isAuthenticated/hasHydrated from a session', () => {
    useAuthStore.getState()._setSession(makeSession() as never);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.hasHydrated).toBe(true);
    expect(state.user).toEqual({
      id: 'user-1',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      createdAt: '2026-08-20T00:00:00.000Z',
    });
  });

  it('clears user/isAuthenticated when given a null session, still marking hydrated', () => {
    useAuthStore.getState()._setSession(makeSession() as never);
    useAuthStore.getState()._setSession(null);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.hasHydrated).toBe(true);
  });
});

describe('initializeAuthListener', () => {
  it('calls _setSession from the initial getSession() resolution', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: makeSession() } } as never);
    mockedSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    } as never);

    initializeAuthListener();
    await Promise.resolve();
    await Promise.resolve();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('falls back to a signed-out session (still marking hydrated) if getSession() rejects', async () => {
    mockedSupabase.auth.getSession.mockRejectedValue(new Error('storage read failed'));
    mockedSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    } as never);

    initializeAuthListener();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.hasHydrated).toBe(true);
  });

  it('returns an unsubscribe function that calls through to the Supabase subscription', () => {
    const unsubscribe = jest.fn();
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null } } as never);
    mockedSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    } as never);

    const cleanup = initializeAuthListener();
    cleanup();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
