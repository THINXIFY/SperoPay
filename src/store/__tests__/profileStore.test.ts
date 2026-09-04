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
      data: {
        id: 'user-1',
        display_name: 'Jane',
        country: 'UAE',
        usage_type: 'business',
        avatar_url: null,
        avatar_border_style: 'aurora',
        onboarding_completed: true,
      },
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
      avatarBorderStyle: 'aurora',
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

describe('loadForUser self-healing insert-fallback', () => {
  it('re-selects instead of erroring when the insert fails with a duplicate-key violation (the row exists but the initial SELECT missed it)', async () => {
    // Simulates the exact race this is guarding against: RLS evaluates
    // auth.uid() against a session that hasn't fully propagated yet on the
    // very first request after sign-in, so the SELECT sees zero rows for an
    // already-onboarded user even though their real row exists -- the
    // fallback INSERT then collides with that real row's primary key.
    const profilesBuilder = makeQueryBuilder({ data: null, error: null });
    const duplicateKeyError = Object.assign(new Error('duplicate key value violates unique constraint "profiles_pkey"'), {
      code: '23505',
    });
    profilesBuilder.single.mockResolvedValueOnce({ data: null, error: duplicateKeyError });
    const realRow = {
      id: 'user-5',
      display_name: 'Already Onboarded',
      country: 'Pakistan',
      usage_type: 'business',
      avatar_url: null,
      avatar_border_style: 'none',
      onboarding_completed: true,
    };
    profilesBuilder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // the initial SELECT that missed the row
      .mockResolvedValueOnce({ data: realRow, error: null }); // the re-select after the insert collision
    const businessBuilder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'profiles' ? profilesBuilder : businessBuilder) as never
    );

    await useProfileStore.getState().loadForUser('user-5');

    const state = useProfileStore.getState();
    expect(state.status).toBe('loaded');
    expect(state.profile?.displayName).toBe('Already Onboarded');
    expect(state.profile?.onboardingCompleted).toBe(true);
    expect(state.profile?.country).toBe('Pakistan');
  });

  it('surfaces the original error (not "loaded") if the duplicate-key re-select also comes back empty', async () => {
    const profilesBuilder = makeQueryBuilder({ data: null, error: null });
    const duplicateKeyError = Object.assign(new Error('duplicate key value violates unique constraint "profiles_pkey"'), {
      code: '23505',
    });
    profilesBuilder.single.mockResolvedValueOnce({ data: null, error: duplicateKeyError });
    profilesBuilder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null }); // re-select still finds nothing real
    const businessBuilder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'profiles' ? profilesBuilder : businessBuilder) as never
    );

    await useProfileStore.getState().loadForUser('user-6');

    expect(useProfileStore.getState().status).toBe('error');
  });

  it('does not swallow a genuine (non-duplicate-key) insert failure', async () => {
    const profilesBuilder = makeQueryBuilder({ data: null, error: null });
    profilesBuilder.single.mockResolvedValueOnce({ data: null, error: new Error('permission denied') });
    const businessBuilder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'profiles' ? profilesBuilder : businessBuilder) as never
    );

    await useProfileStore.getState().loadForUser('user-7');

    expect(useProfileStore.getState().status).toBe('error');
  });
});

describe('setUsageType', () => {
  it('persists usage_type to profiles and reflects it locally', async () => {
    useProfileStore.setState({
      profile: { usageType: null, displayName: 'Jane', country: '', avatarBorderStyle: 'none', onboardingCompleted: false },
      status: 'loaded',
      error: null,
    });
    const profilesBuilder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(profilesBuilder as never);

    await useProfileStore.getState().setUsageType('user-1', 'freelancer');

    expect(profilesBuilder.update).toHaveBeenCalledWith({ usage_type: 'freelancer' });
    expect(useProfileStore.getState().profile?.usageType).toBe('freelancer');
  });
});

describe('completeOnboarding', () => {
  it('persists onboarding_completed: true to profiles and reflects it locally', async () => {
    useProfileStore.setState({
      profile: { usageType: 'business', displayName: 'Jane', country: 'UAE', avatarBorderStyle: 'none', onboardingCompleted: false },
      status: 'loaded',
      error: null,
    });
    const profilesBuilder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(profilesBuilder as never);

    await useProfileStore.getState().completeOnboarding('user-1');

    expect(profilesBuilder.update).toHaveBeenCalledWith({ onboarding_completed: true });
    expect(useProfileStore.getState().profile?.onboardingCompleted).toBe(true);
  });

  it('sets a calm error and rethrows on failure, so a caller can keep the user on the current step rather than navigating to Home', async () => {
    // .update(...).eq(...) is the terminal call here (no further .single()/
    // .maybeSingle()) -- makeQueryBuilder's shared `eq` only supports mid-
    // chain use (returning the builder so a later .maybeSingle() can still
    // be called on it), so this test overrides it directly to resolve with
    // the error, matching how the real (thenable) PostgrestFilterBuilder
    // behaves when awaited straight off .eq().
    const profilesBuilder = makeQueryBuilder({ data: null, error: null });
    profilesBuilder.eq = jest.fn(() => Promise.resolve({ data: null, error: new Error('network request failed') }));
    mockedSupabase.from.mockReturnValue(profilesBuilder as never);

    await expect(useProfileStore.getState().completeOnboarding('user-1')).rejects.toThrow();
    expect(useProfileStore.getState().error).not.toBeNull();
  });
});

describe('reset', () => {
  it('clears profile back to idle', () => {
    useProfileStore.setState({
      profile: { usageType: null, displayName: 'X', country: '', avatarBorderStyle: 'none', onboardingCompleted: false },
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
      profile: { usageType: 'business', displayName: 'Jane', country: 'UAE', avatarBorderStyle: 'none', onboardingCompleted: true },
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

  it('persists a new avatarUri and avatarBorderStyle to profiles, and reflects both locally', async () => {
    useProfileStore.setState({
      profile: { usageType: null, displayName: 'Jane', country: '', avatarBorderStyle: 'none', onboardingCompleted: true },
      status: 'loaded',
      error: null,
    });
    const profilesBuilder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(profilesBuilder as never);

    await useProfileStore
      .getState()
      .updateProfile('user-1', { avatarUri: 'https://cdn.example.com/users/user-1/1.jpg', avatarBorderStyle: 'lime' });

    expect(profilesBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: 'https://cdn.example.com/users/user-1/1.jpg', avatar_border_style: 'lime' })
    );
    expect(useProfileStore.getState().profile?.avatarUri).toBe('https://cdn.example.com/users/user-1/1.jpg');
    expect(useProfileStore.getState().profile?.avatarBorderStyle).toBe('lime');
  });

  it('clears avatarUri (removes the photo) by writing null, not omitting the field', async () => {
    useProfileStore.setState({
      profile: {
        usageType: null,
        displayName: 'Jane',
        country: '',
        avatarUri: 'https://cdn.example.com/old.jpg',
        avatarBorderStyle: 'none',
        onboardingCompleted: true,
      },
      status: 'loaded',
      error: null,
    });
    const profilesBuilder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(profilesBuilder as never);

    await useProfileStore.getState().updateProfile('user-1', { avatarUri: undefined });

    expect(profilesBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ avatar_url: null }));
    expect(useProfileStore.getState().profile?.avatarUri).toBeUndefined();
  });
});

describe('avatar border style fallback', () => {
  it('falls back to "none" when the stored value is not one of the known presets', async () => {
    const profilesBuilder = makeQueryBuilder({
      data: {
        id: 'user-4',
        display_name: 'Jane',
        country: '',
        usage_type: null,
        avatar_url: null,
        avatar_border_style: 'some-future-value-this-client-does-not-know-about',
        onboarding_completed: true,
      },
      error: null,
    });
    const businessBuilder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'profiles' ? profilesBuilder : businessBuilder) as never
    );

    await useProfileStore.getState().loadForUser('user-4');

    expect(useProfileStore.getState().profile?.avatarBorderStyle).toBe('none');
  });
});
