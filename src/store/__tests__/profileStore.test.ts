jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '../../lib/supabase';
import { useProfileStore } from '../profileStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.insert = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.upsert = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useProfileStore.setState({ profile: null, status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('merges profiles + business_profiles rows into the flat Profile shape', async () => {
    const profilesBuilder = makeQueryBuilder({
      data: { id: 'user-1', display_name: 'Jane', country: 'UAE', usage_type: 'business', avatar_url: null, onboarding_completed: true },
      error: null,
    });
    const businessBuilder = makeQueryBuilder({
      data: { business_name: 'Jane LLC', business_email: 'jane@biz.com', website: 'https://jane.biz', description: 'desc', logo_url: null },
      error: null,
    });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'profiles' ? profilesBuilder : businessBuilder) as never
    );

    await useProfileStore.getState().loadForUser('user-1');

    const state = useProfileStore.getState();
    expect(state.status).toBe('loaded');
    expect(state.profile).toEqual({
      usageType: 'business',
      displayName: 'Jane',
      businessName: 'Jane LLC',
      country: 'UAE',
      website: 'https://jane.biz',
      avatarUri: undefined,
      businessEmail: 'jane@biz.com',
      businessDescription: 'desc',
      businessLogoUri: undefined,
      onboardingCompleted: true,
    });
  });

  it('creates a minimum valid profile if none exists yet, seeded from the auth full name', async () => {
    const profilesBuilder = makeQueryBuilder({ data: null, error: null });
    const insertedProfile = { id: 'user-2', display_name: 'New User', country: '', usage_type: null, avatar_url: null, onboarding_completed: false };
    profilesBuilder.single.mockResolvedValueOnce({ data: insertedProfile, error: null });
    const businessBuilder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'profiles' ? profilesBuilder : businessBuilder) as never
    );

    await useProfileStore.getState().loadForUser('user-2', 'New User');

    expect(profilesBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-2', display_name: 'New User' })
    );
    expect(useProfileStore.getState().profile?.displayName).toBe('New User');
  });

  it('sets status to error with calm copy on failure, without leaking the raw error', async () => {
    const profilesBuilder = makeQueryBuilder({ data: null, error: new Error('relation missing') });
    mockedSupabase.from.mockReturnValue(profilesBuilder as never);

    await useProfileStore.getState().loadForUser('user-3');

    const state = useProfileStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe("We couldn't load your profile. Try again.");
  });

  it('discards a stale response from a previous loadForUser call that resolves after a newer one', async () => {
    // Simulates User A's fetch stalling, User B signing in and their (faster)
    // fetch landing first, then User A's late response finally arriving —
    // it must NOT overwrite User B's already-loaded profile.
    let resolveUserA: (value: { data: unknown; error: null }) => void = () => {};
    const userAProfilePromise = new Promise((resolve) => {
      resolveUserA = resolve;
    });
    const userABuilder = makeQueryBuilder({ data: null, error: null });
    userABuilder.maybeSingle.mockImplementation(() => userAProfilePromise as never);
    const userBBuilder = makeQueryBuilder({
      data: { id: 'user-B', display_name: 'Bob', country: '', usage_type: null, avatar_url: null, onboarding_completed: true },
      error: null,
    });
    const businessBuilder = makeQueryBuilder({ data: null, error: null });
    let currentUser: 'A' | 'B' = 'A';

    mockedSupabase.from.mockImplementation((table: string) => {
      if (table === 'business_profiles') return businessBuilder as never;
      // First call (User A) gets the stalling builder; second call
      // onward (User B) gets the fast one — matches from() being called
      // fresh on each loadForUser invocation.
      return currentUser === 'A' ? (userABuilder as never) : (userBBuilder as never);
    });

    const loadA = useProfileStore.getState().loadForUser('user-A');

    currentUser = 'B';
    await useProfileStore.getState().loadForUser('user-B');
    expect(useProfileStore.getState().profile?.displayName).toBe('Bob');

    // User A's stalled response finally arrives.
    resolveUserA({ data: { id: 'user-A', display_name: 'Alice', country: '', usage_type: null, avatar_url: null, onboarding_completed: true }, error: null });
    await loadA;

    expect(useProfileStore.getState().profile?.displayName).toBe('Bob');
  });
});

describe('reset', () => {
  it('clears profile back to idle', () => {
    useProfileStore.setState({
      profile: { usageType: null, displayName: 'X', country: '', onboardingCompleted: false },
      status: 'loaded',
      error: null,
    });
    useProfileStore.getState().reset();
    const state = useProfileStore.getState();
    expect(state.profile).toBeNull();
    expect(state.status).toBe('idle');
  });
});

describe('updateProfile', () => {
  it('routes personal fields to profiles and business fields to business_profiles', async () => {
    useProfileStore.setState({
      profile: { usageType: 'business', displayName: 'Jane', country: 'UAE', onboardingCompleted: true },
      status: 'loaded',
      error: null,
    });
    const profilesBuilder = makeQueryBuilder({ data: {}, error: null });
    const businessBuilder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'profiles' ? profilesBuilder : businessBuilder) as never
    );

    await useProfileStore.getState().updateProfile('user-1', { displayName: 'Janet', businessName: 'Janet LLC' });

    expect(profilesBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Janet' }));
    expect(businessBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', business_name: 'Janet LLC' }),
      { onConflict: 'user_id' }
    );
  });
});
