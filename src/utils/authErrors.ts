export type AuthErrorContext = 'sign-in' | 'sign-up' | 'reset-password' | 'update-password';

const CONTEXT_FALLBACKS: Record<AuthErrorContext, string> = {
  'sign-in': "We couldn't sign you in right now. Please try again.",
  'sign-up': "We couldn't create your account right now. Please try again.",
  'reset-password': "We couldn't send that reset link right now. Please try again.",
  'update-password': "We couldn't update your password right now. Please try again.",
};

export function getAuthErrorMessage(error: unknown, context: AuthErrorContext = 'sign-in'): string {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const normalized = message.toLowerCase();

  if (name.includes('PKCE') || name.includes('ImplicitGrant') || normalized.includes('code verifier')) {
    return 'This link is no longer valid. Request a new one and open it on this device.';
  }
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
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('timeout')) {
    return "We couldn't connect right now. Check your internet connection and try again.";
  }

  return CONTEXT_FALLBACKS[context];
}
