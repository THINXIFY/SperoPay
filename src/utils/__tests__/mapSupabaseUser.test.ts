import { mapSupabaseUser } from '../mapSupabaseUser';
import type { User as SupabaseUser } from '@supabase/supabase-js';

function makeSupabaseUser(overrides: Partial<SupabaseUser> = {}): SupabaseUser {
  return {
    id: 'user-123',
    app_metadata: {},
    user_metadata: { full_name: 'Jane Doe' },
    aud: 'authenticated',
    created_at: '2026-08-20T00:00:00.000Z',
    email: 'jane@example.com',
    ...overrides,
  } as SupabaseUser;
}

describe('mapSupabaseUser', () => {
  it('maps id, full name, email, and createdAt from a Supabase user', () => {
    const result = mapSupabaseUser(makeSupabaseUser());
    expect(result).toEqual({
      id: 'user-123',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      createdAt: '2026-08-20T00:00:00.000Z',
    });
  });

  it('falls back to an empty full name when user_metadata.full_name is missing', () => {
    const result = mapSupabaseUser(makeSupabaseUser({ user_metadata: {} }));
    expect(result.fullName).toBe('');
  });

  it('falls back to an empty email when the Supabase user has none', () => {
    const result = mapSupabaseUser(makeSupabaseUser({ email: undefined }));
    expect(result.email).toBe('');
  });
});
