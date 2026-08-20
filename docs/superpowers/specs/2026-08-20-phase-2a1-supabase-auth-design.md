# SperoPay — Phase 2A-1: Supabase Foundation, Real Authentication & Route Protection

Status: Approved
Date: 2026-08-20

## 1. Purpose

Replace the app's mock authentication with real Supabase Auth (real sign-up, sign-in, session persistence, session restoration, reactive route protection, real sign-out), while every other subsystem (Requests, Customers, Templates, Transactions, Wallet, Business Profile, payment simulation) stays exactly on its current local Zustand/mock architecture. This is the first phase to introduce a real backend dependency into the app.

## 2. Audit findings that drive this design

- **`authStore.ts` today** is a `persist`-wrapped mock: `signIn`/`signUp` always succeed after a fake delay, `error` is dead write-only state, no credential checking exists at all.
- **`onboardingStore.ts`** is a single global boolean, not keyed by user — explicitly preserved as-is per scope (`Do not rewrite the existing onboarding system yet`).
- **Exactly one auth-based routing decision exists in the whole app**: `app/index.tsx` (the splash screen), which waits for both stores' `hasHydrated` flags plus a 1200ms branding timer, then does a single `router.replace(...)` to Welcome, Onboarding, or Home. **No other screen or layout re-checks auth state** — confirmed via exhaustive grep. This was survivable for a mock session that only ever changes via a manual Sign Out button, but a real Supabase session can also end reactively (expiry, revocation), so this phase adds one additional, reactive layer.
- **Zero existing tests touch auth.** Clean slate, no risk of breaking existing coverage.
- `@supabase/supabase-js` and `react-native-url-polyfill` are not installed. No `.env*` files exist yet; `.gitignore` only ignores `.env*.local`, not plain `.env`.
- `User` (mock auth identity: `id`, `fullName`, `email`, `createdAt`) and `Profile` (business profile, onboarding-collected) are already distinct types — this phase only touches `User`.
- Sign Out today touches only `authStore` + `onboardingStore`, nothing else — this exact scope is preserved.

## 3. Architecture decisions

### 3.1 Supabase becomes the single source of truth for session persistence — `authStore` is no longer independently persisted

Today `authStore` is `persist`-wrapped (mirrors its own copy of `user`/`isAuthenticated` to AsyncStorage under `speropay/auth`). Supabase's client, configured with `persistSession: true`, already persists the real session to AsyncStorage under its own key. Keeping both would create exactly the "two competing sources of truth" the phase brief explicitly forbids — a stale zustand-persisted `isAuthenticated: true` surviving on disk from a previous session, independent of what Supabase actually restored, is a real desync risk.

**Decision:** `authStore` drops the `persist` wrapper entirely and becomes a thin, in-memory reactive projection of Supabase's actual auth state, populated two ways:
1. Once, on app start: `supabase.auth.getSession()` resolves with whatever Supabase already restored from *its own* persistence.
2. Continuously: `supabase.auth.onAuthStateChange(...)` keeps the store in sync for the lifetime of the app (covers sign-in, sign-out, and future token-expiry events).

Both paths funnel through one internal action, `_setSession(session)`, so there is exactly one code path that ever writes `session`/`user`/`isAuthenticated`/`hasHydrated`.

### 3.2 Route protection: a splash-time decision plus a reactive backstop

The splash screen's one-time redirect is preserved (same three-way branch, same UX), but now reads real `isAuthenticated`/`hasHydrated` instead of mock-store-hydration. Since a real session can end reactively (not just via the Sign Out button), a second, thin layer is added: a small `AuthGate` component wraps each of the three top-level layouts (`(auth)`, `(onboarding)`, `(app)`) and re-evaluates on every render. If Supabase's listener ever reports `isAuthenticated: false` while the user is deep inside `(app)/*`, the gate reacts immediately rather than leaving a stale authenticated screen reachable.

The actual decision logic (`resolveInitialRoute`, `resolveAuthGateRedirect`) is pure, dependency-free, and lives in `src/utils/authRouting.ts` — this is what makes "route protection behavior" testable per the phase's own requirement, without needing to render real navigation components (matching this project's established convention of extracting pure decision logic out of screens for TDD, e.g. `paymentSimulation.ts`'s guards).

### 3.3 Sign-up's two outcomes reuse an existing UI pattern, not a new screen

`forgot-password.tsx` already has a local "sent" boolean that swaps the form for a static confirmation message. Sign-up's "email confirmation required" outcome reuses the exact same pattern (a local `needsConfirmation` boolean) rather than introducing a new route — keeping the footprint minimal per "do not build the complete email-confirmation/deep-link system yet."

### 3.4 Forgot Password sends a real reset email, nothing more

The phase brief allows "trivial plumbing" for this screen. Calling `supabase.auth.resetPasswordForEmail(email)` is a single real API call requiring no new screens and no deep-link handling — the actual reset *completion* flow (a working link, a reset-password screen, recovery-session handling) is what's deferred to Phase 2A-2. The existing UI and its already-honest copy ("If an account exists for that email...") are unchanged.

### 3.5 Error mapping is context-aware

`getAuthErrorMessage(error, context)` takes an optional `'sign-in' | 'sign-up'` context so the generic fallback line reads correctly regardless of which screen hit it ("We couldn't sign you in..." vs. "We couldn't create your account...") rather than a login-flavored message leaking onto the sign-up screen.

### 3.6 Fail fast and loud on missing configuration

`src/lib/supabase.ts` throws immediately at import time if `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` are missing, with a message telling the developer to copy `.env.example`. This only affects real app runtime (tests mock the module entirely, never executing this path) and directly serves the phase's own "clear authentication errors" goal — a silent `undefined` URL would otherwise surface as a confusing low-level fetch failure deep inside the Supabase client instead of an immediate, actionable message.

## 4. Files

| File | Change |
|---|---|
| `package.json` | Add `@supabase/supabase-js`, `react-native-url-polyfill` |
| `.env.example` | New — documents the two required variables |
| `.gitignore` | Add `.env` (plain, not just `.env*.local`) |
| `src/lib/supabase.ts` | New — the one centralized client, AppState-driven token refresh |
| `src/utils/mapSupabaseUser.ts` | New (TDD) — Supabase user → app `User` shape |
| `src/utils/authErrors.ts` | New (TDD) — Supabase error → human-friendly copy |
| `src/utils/authRouting.ts` | New (TDD) — pure `resolveInitialRoute`, `resolveAuthGateRedirect` |
| `src/store/authStore.ts` | Rewritten — real Supabase-backed, no longer `persist`-wrapped |
| `src/components/AuthGate.tsx` | New — reactive route-protection wrapper |
| `app/_layout.tsx` | Modify — wire up the auth listener with cleanup |
| `app/index.tsx` | Modify — use `resolveInitialRoute`, new hydration source |
| `app/(auth)/_layout.tsx` | Modify — wrap in `AuthGate mode="require-guest"` |
| `app/(onboarding)/_layout.tsx` | Modify — wrap in `AuthGate mode="require-auth"` |
| `app/(app)/_layout.tsx` | Modify — wrap in `AuthGate mode="require-auth"` |
| `app/(auth)/login.tsx` | Modify — real `signIn`, visible error state |
| `app/(auth)/sign-up.tsx` | Modify — real `signUp`, email-confirmation branch |
| `app/(auth)/forgot-password.tsx` | Modify — real `resetPasswordForEmail` |
| `app/(app)/profile/index.tsx` | Modify — async sign-out |

## 5. Explicitly out of scope (per phase brief §24)

`profiles` database table, Customers/Requests/Transactions databases, RLS policies, migrations, Supabase Storage, Realtime, real wallet integration, blockchain APIs, real payments, real email-confirmation deep-link handling, production password recovery completion, account deletion.

## 6. Completion criteria

Matches phase brief §25: Supabase client configured; env vars supported; real signup/login work; session persistence and restoration work; auth state listener works; route protection works; sign-out works; email-confirmation-no-session handled safely; loading states work; error copy is human-friendly; no hardcoded credentials; Phase 1 data remains functional; TypeScript passes; existing tests pass; new auth tests pass; no Phase 1 regression.

## 7. Verification plan

- `npx tsc --noEmit`, `npx jest` after each task and at the end
- Pure-function tests for all new `src/utils/` helpers and a mocked-Supabase `authStore` test suite — no live Supabase project involved
- Manual scenario trace (code-level, no device) matching phase brief §23's five scenarios
- Final holistic review across the whole branch diff before merge, per established process
