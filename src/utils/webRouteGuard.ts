// Phase 5B's web-surface guard: Spero's primary product is the native
// Android app -- the web deployment exists ONLY so a customer can open a
// payment link or client portal without installing anything. This is the
// single source of truth for which URL paths are allowed to render the
// real app on web; everything else renders WebLandingScreen instead (see
// app/_layout.tsx). Native builds never call this at all (the call site is
// itself gated on Platform.OS === 'web').
//
// Deliberately fail-closed (an allowlist, not a denylist): a route added
// later under app/(app)/, app/request/, app/recurring/, etc. is
// automatically blocked on web without anyone needing to remember to add
// it to a block list.
//
// Two exact-match exceptions beyond /p, /c, /invoice, /receipt:
// /auth/callback and /reset-password. Spero's real auth redirect URL is the
// native "speropay://auth/callback" scheme (see authDeepLink.ts) -- in
// ordinary use, a password-recovery or email-confirmation link never
// actually opens the web build at all. These two are allowed anyway,
// defensively: if a recovery link is ever opened somewhere the native
// scheme can't handle (an old device, a different browser, a future web
// fallback in Supabase's own redirect config), a merchant must still be
// able to finish resetting their password rather than dead-ending on a
// marketing page with no way forward. Neither screen exposes any merchant
// dashboard data.
const WEB_PUBLIC_PATH_PREFIXES = ['/p/', '/c/', '/invoice/', '/receipt/'];
const WEB_PUBLIC_EXACT_PATHS = ['/auth/callback', '/reset-password'];

export function isWebPubliclyAllowedPath(pathname: string): boolean {
  if (WEB_PUBLIC_EXACT_PATHS.includes(pathname)) return true;
  return WEB_PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
