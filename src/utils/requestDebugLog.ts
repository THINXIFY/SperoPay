// Temporary, __DEV__-only checkpoint logging for payment-request creation --
// added specifically to diagnose a real-device/live-Supabase failure
// (the actual RPC response, not just "it didn't work") that TypeScript/
// Jest can't catch. Never logs auth tokens, session data, or any other
// credential -- only the specific safe fields named at each call site
// (a user id, a generated payment_code/reference, a Postgres error
// code/message/details/hint).
export function requestDebugLog(checkpoint: string, details?: Record<string, unknown>): void {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log(`[request] ${checkpoint}`, details ?? '');
}
