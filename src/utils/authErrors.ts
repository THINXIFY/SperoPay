export type AuthErrorContext = 'sign-in' | 'sign-up';

export function getAuthErrorMessage(error: unknown, context: AuthErrorContext = 'sign-in'): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (normalized.includes('already registered')) {
    return 'An account already exists with this email.';
  }
  if (normalized.includes('password') && /short|weak|at least|characters/.test(normalized)) {
    return 'Choose a stronger password.';
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return "We couldn't connect. Check your internet connection and try again.";
  }

  return context === 'sign-up'
    ? "We couldn't create your account right now. Please try again."
    : "We couldn't sign you in right now. Please try again.";
}
