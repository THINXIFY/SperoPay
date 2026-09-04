// Temporary, __DEV__-only checkpoint logging for the signup/confirmation/
// login flow -- added specifically to diagnose a real-device failure
// (Supabase's actual response, not just "it didn't work") that TypeScript/
// tests can't catch. Never logs passwords, access/refresh tokens, or any
// other credential -- only the specific safe fields named at each call
// site (booleans, counts, error codes/messages, non-secret ids).
export function authDebugLog(checkpoint: string, details?: Record<string, unknown>): void {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log(`[auth] ${checkpoint}`, details ?? '');
}
