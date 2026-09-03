// Temporary, __DEV__-only checkpoint logging for the profile/customer image
// pipeline, added specifically to diagnose a real-device failure that
// TypeScript/tests can't catch (this is a runtime data/IO path: native
// picker -> crop -> manipulate -> Storage upload -> DB write). Never logs
// auth tokens, keys, or full Storage/DB response bodies -- only the
// specific safe fields named at each call site.
export function avatarDebugLog(checkpoint: string, details?: Record<string, unknown>): void {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log(`[avatar] ${checkpoint}`, details ?? '');
}
