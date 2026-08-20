import { resolveDisplayName } from '../resolveDisplayName';

describe('resolveDisplayName', () => {
  it('prefers the locally edited profile name', () => {
    expect(resolveDisplayName('Jane Doe', 'Jane D. Auth', 'jane@example.com')).toBe('Jane Doe');
  });

  it('falls back to the Supabase full name when the profile name is blank', () => {
    expect(resolveDisplayName('', 'Jane Auth', 'jane@example.com')).toBe('Jane Auth');
    expect(resolveDisplayName(undefined, 'Jane Auth', 'jane@example.com')).toBe('Jane Auth');
  });

  it('falls back to the email local part when both names are blank', () => {
    expect(resolveDisplayName('', '', 'jane@example.com')).toBe('jane');
  });

  it('treats whitespace-only names as blank', () => {
    expect(resolveDisplayName('   ', '  ', 'jane@example.com')).toBe('jane');
  });

  it('returns an empty string when nothing is available, letting the caller supply its own fallback', () => {
    expect(resolveDisplayName(undefined, undefined, undefined)).toBe('');
  });
});
