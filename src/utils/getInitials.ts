// Shared by every avatar's initials fallback (UserAvatar, CustomerAvatar) --
// first letter of up to the first two whitespace-separated words, uppercased.
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}
