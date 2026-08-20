// Priority: an intentionally-edited local profile name, then the Supabase
// account's full_name, then an email-derived fallback. Returns '' (not a
// hardcoded word) when nothing is available — callers already have their own
// context-appropriate final fallback ("there" for a greeting, "Your Name" for
// a profile header) and this keeps that choice with them.
export function resolveDisplayName(
  profileName: string | undefined,
  authFullName: string | undefined,
  email: string | undefined
): string {
  const trimmedProfile = profileName?.trim();
  if (trimmedProfile) return trimmedProfile;

  const trimmedAuthName = authFullName?.trim();
  if (trimmedAuthName) return trimmedAuthName;

  const emailLocalPart = email?.split('@')[0]?.trim();
  return emailLocalPart || '';
}
