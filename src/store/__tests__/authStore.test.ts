jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
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
  });
});

describe('signUp', () => {
  it('reports needsEmailConfirmation: false when a session is returned', async () => {
    const session = makeSession();
    mockedSupabase.auth.signUp.mockResolvedValue({ data: { session, user: session.user }, error: null } as never);

    const result = await useAuthStore.getState().signUp('Jane Doe', 'jane@example.com', 'password123');

    expect(result).toEqual({ needsEmailConfirmation: false });
    expect(mockedSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'password123',
      options: { data: { full_name: 'Jane Doe' } },
    });
  });

  it('reports needsEmailConfirmation: true when no session is returned', async () => {
    const session = makeSession();
    mockedSupabase.auth.signUp.mockResolvedValue({ data: { session: null, user: session.user }, error: null } as never);

    const result = await useAuthStore.getState().signUp('Jane Doe', 'jane@example.com', 'password123');

    expect(result).toEqual({ needsEmailConfirmation: true });
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
