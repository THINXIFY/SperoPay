// The single place that clears every Supabase-backed store's cached data.
// Called on sign-out and defensively before loading a newly-signed-in user's
// data, so a moment of stale User-A state can never render while User-B's
// fetch is still in flight. Each store registers its own reset() here as it
// migrates — this file is intentionally the only place that knows about all
// of them, so nothing can be missed by scattering the call sites.
type ResetFn = () => void;

const resetters: ResetFn[] = [];

export function registerResettable(reset: ResetFn): void {
  resetters.push(reset);
}

export function resetAllUserData(): void {
  for (const reset of resetters) {
    reset();
  }
}
