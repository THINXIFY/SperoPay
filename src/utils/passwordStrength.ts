export type PasswordStrength = 'weak' | 'good' | 'strong';

// Purely a UI hint layered on top of the project's real requirement
// (isValidPassword: 8+ characters, enforced client-side and by Supabase)
// -- never itself a validation gate. Weak still means "meets the 8-char
// minimum", just without much variety; nothing here blocks submission.
export function getPasswordStrength(password: string): PasswordStrength {
  const length = password.length;
  const varietyCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((pattern) => pattern.test(password)).length;

  if (length >= 12 && varietyCount >= 3) return 'strong';
  if (length >= 8 && varietyCount >= 2) return 'good';
  return 'weak';
}
