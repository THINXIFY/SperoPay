# SperoPay — Phase 2A-2: Auth Completion, Password Recovery, Email Confirmation & User Identity Sync

Status: Approved
Date: 2026-08-21

## 1. Purpose

Finish and harden the authentication/account experience Phase 2A-1 started: real password recovery (with a working deep link back into the app), a completed email-confirmation experience (with resend), per-user onboarding isolation, real Change Password, better identity sync from the Supabase user into the UI, and general auth-state/error-handling hardening. Phase 2A-1's architecture (Supabase as sole session authority, centralized pure routing functions, `AuthGate`) is extended, not replaced.

## 2. Audit findings that drive this design

- **`src/lib/supabase.ts`** has no `flowType` set, so the client defaults to Supabase's implicit flow. Implicit-flow recovery/confirmation links put the session token in a URL fragment (`#access_token=...`), which is fragile to parse reliably from a React Native deep link. **PKCE is the right flow for a mobile app** and is already half-set-up: `detectSessionInUrl: false` is already correct for RN (there's no browser URL to auto-parse), and `AsyncStorage` is already configured as the client's storage, which PKCE needs to stash a code verifier between "user requests reset" and "user taps the emailed link."
- **Confirmed via reading `@supabase/auth-js` source directly** (not just docs): `resetPasswordForEmail()` calls `_getCodeChallengeAndMethod(true /* isPasswordRecovery */)`, which stores `redirectType: 'recovery'` alongside the PKCE code verifier, keyed by a `flowId` that gets appended to the `redirectTo` URL. When `exchangeCodeForSession(code)` is later called, it reads that stored `redirectType` back out and fires `PASSWORD_RECOVERY` instead of `SIGNED_IN` on `onAuthStateChange` — **automatically, with no `type` URL param needed from us.** `signUp()`'s confirmation flow stores no such recovery flag, so its exchange fires plain `SIGNED_IN`. This means one shared code path (one callback screen, one `exchangeCodeForSession` call) can serve both recovery and confirmation links, and the SDK itself tells us which one it was via the event name — exactly the "one centralized deep-link handling strategy" the phase brief asks for.
- **`app.json`** already has `"scheme": "speropay"`, `expo-linking` is already an installed dependency (unused so far) — no new native config needed for the deep-link URL itself.
- **`authRouting.ts`'s `resolveInitialRoute`/`resolveAuthGateRedirect`** currently take `{ isAuthenticated, hasCompletedOnboarding }`. A `PASSWORD_RECOVERY` session sets `isAuthenticated: true` (a real session now exists), so without change these functions would send a mid-recovery user straight to Home or Onboarding — the exact "recovery session mistaken for ordinary login" failure the brief warns against. This is the main routing risk in this phase.
- **`onboardingStore.ts`** is a single global `hasCompletedOnboarding: boolean`, not keyed by user — confirmed via grep, exactly the gap section 10 describes. Its only mutation site is `wallet-setup.tsx`'s `completeOnboarding()` call (one call site, grep-confirmed) — a small, contained change.
- **`profile/security.tsx`'s "Change Password"** is fully mocked today: a fake `await new Promise(setTimeout(...))`, and it collects a "Current Password" field that is never actually checked against anything. The phase brief's field list for this screen (§6) is just New Password + Confirm Password — no Current Password. Wiring this to `supabase.auth.updateUser({ password })` doesn't need or use a current-password value (an active session already authorizes the change), so the honest fix is to **remove the fake Current Password field**, not wire it to nothing.
- **`app/(auth)/sign-up.tsx`'s `needsConfirmation` state** already exists and reuses `forgot-password.tsx`'s "sent" pattern (from 2A-1) — this phase extends that same screen state with Resend + Open Email App, rather than building a new screen.
- **Identity display**: `home.tsx` and `profile/index.tsx` both read `profile.displayName` directly with an inline fallback string (`'there'` / `'Your Name'`). Neither currently considers `authStore.user.fullName` (the Supabase `user_metadata.full_name` set at sign-up). `(onboarding)/profile.tsx`'s Display Name field also starts blank (`useState(profile.displayName)`, and `profile.displayName` is `''` in `emptyProfile`) rather than pre-filling from the just-created Supabase account's name.
- **Auth-state handling is already state-driven, not event-driven-navigation**: `initializeAuthListener` already funnels every event through one `_setSession` call, and screens/`AuthGate` react to the resulting state rather than to raw event names. This is exactly the pattern section 14 asks for — it needs *extending* (to also track `isPasswordRecovery` and an "unexpected sign-out" flag) rather than restructuring.
- Ran `npx tsc --noEmit` and `npx jest` on the fresh worktree before starting: clean, 19 suites / 106 tests passing.

## 3. Architecture decisions

### 3.1 PKCE flow + one centralized deep-link callback route

`src/lib/supabase.ts` adds `flowType: 'pkce'` to the client config. A new **plain route** `app/auth/callback.tsx` (deliberately *not* inside the `(auth)` group, so it is never wrapped by `AuthGate`'s require-guest redirect — see 3.2) is the single place that calls `supabase.auth.exchangeCodeForSession(code)`, for both recovery and sign-up-confirmation links. The `code` query param arrives as a normal Expo Router route param (`useLocalSearchParams`), since the redirect URL is a same-scheme deep link the router already resolves — no manual `Linking` listener needed, and no `type` param to plumb through ourselves (the SDK figures out `PASSWORD_RECOVERY` vs `SIGNED_IN` on its own, per 2's audit finding). A single `getAuthCallbackUrl()` helper (`Linking.createURL('/auth/callback')`) is used as the `redirectTo`/`emailRedirectTo` for `resetPasswordForEmail`, `signUp`, and `resend` — one URL, one screen, one exchange call, regardless of which flow it's serving.

The callback screen guards against re-processing the same code twice (a `useRef` "already attempted" flag), shows a branded loading state while exchanging, and on failure (expired/already-used/wrong-device code — a real, expected case for PKCE, since the code verifier lives only on the device that requested it) shows a calm "This link is no longer valid — request a new one" state with a way back to Sign In. On success it does not navigate itself for the common cases — it hands off to the centralized routing in 3.2, which already knows what to do with the resulting state.

### 3.2 Recovery sessions are a distinct routing state, handled centrally

`authStore` adds `isPasswordRecovery: boolean`, set `true` when `onAuthStateChange` reports the `PASSWORD_RECOVERY` event (in the same `_setSession`-funneling listener, not a new one), and cleared only in two deliberate places: a successful `completePasswordRecovery()` (the Reset Password screen's password-update action), and defensively inside `signOut()`. `AuthRoutingState` (in `authRouting.ts`) gains `isPasswordRecovery`, checked **first**, before the existing `isAuthenticated`/`hasCompletedOnboarding` logic, in all three routing functions:

- `resolveInitialRoute`: recovery → `/(auth)/reset-password`, overriding what would otherwise be Home/Onboarding.
- `resolveAuthGateRedirect('require-guest', ...)`: recovery is treated as guest-equivalent (returns `null`, i.e. stays put) instead of the normal "authenticated → bounce out of `(auth)`" behavior — this is what lets the Reset Password screen actually be reachable inside `(auth)` despite `isAuthenticated` being `true`.
- `resolveAuthGateRedirect('require-auth', ...)`: recovery **redirects to** `/(auth)/reset-password` instead of the normal "authenticated → allow" — a recovery session must not grant Home/Onboarding access before a new password is set.

This keeps the "avoid redirect loops / Home opening instead of Reset Password / recovery mistaken for login" requirement satisfied in exactly one place (three pure functions, already unit-tested in 2A-1), rather than as special cases scattered across screens — directly serving the brief's own "this logic should be centralized" instruction (§11), reused for both the onboarding-routing problem (§11) and the recovery-routing problem (§4) with the same mechanism.

### 3.3 Per-user onboarding completion

`onboardingStore` changes `hasCompletedOnboarding: boolean` to `completedUserIds: string[]` (a small persisted list of Supabase user IDs who've finished onboarding on this device). A new hook, `useHasCompletedOnboarding()`, exported from the same file, reads the current user's ID from `authStore` and returns `completedUserIds.includes(userId)` — this becomes the one place `app/index.tsx`, `AuthGate.tsx`, `login.tsx`, `sign-up.tsx`, and `app/auth/callback.tsx` read onboarding-completion from, replacing their direct `useOnboardingStore((s) => s.hasCompletedOnboarding)` reads. `wallet-setup.tsx`'s `completeOnboarding()` becomes `completeOnboarding(userId)`, adding that ID to the list. This is local-only persistence (as the brief explicitly allows for this phase) — no `profiles` table.

### 3.4 Change Password: honest scope, matches the brief's field list exactly

`profile/security.tsx`'s Change Password section drops the non-functional "Current Password" field (it was never checked against anything — Phase 1A mock leftover) and keeps exactly New Password + Confirm Password, per §6. Calls `supabase.auth.updateUser({ password })`. If Supabase ever returns a reauthentication-required error (not the default behavior for password updates, but a possible project-level configuration), the screen shows a calm "For your security, please sign out and sign back in, then try again" message rather than inventing a fake local reauth check — directly matching §6's "handle that safely rather than inventing insecure custom behavior."

### 3.5 Resend confirmation: client-side cooldown, not a fight with Supabase's own rate limit

`authStore.resendConfirmationEmail(email)` wraps `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } })`. The sign-up confirmation screen tracks a short local cooldown (disables the button for ~30s after a successful send) so the UI itself prevents rapid re-taps with a calm "Resend available in Ns" state, rather than letting every extra tap round-trip to Supabase and surface its own rate-limit error.

### 3.6 "Open Email App" is best-effort, not a guarantee

There is no reliable, config-free cross-platform API in this app's current Expo Go/no-custom-native-module setup for "open the user's mail app to their inbox" — iOS has no public inbox-opening URL scheme, and Android's equivalent needs an intent Expo's `Linking` API doesn't expose without extra native config. The confirmation screen's "Open Email App" button attempts `Linking.openURL('message://')` (the informal iOS Mail scheme) wrapped in a silent catch; if it doesn't work on a given device/platform, the button simply does nothing rather than erroring. This matches the brief's own "if practical" qualifier (§7) and is called out explicitly in the final report rather than oversold.

### 3.7 Session-expiry messaging without a new global system

A module-level (not store-state) flag inside `authStore.ts`, set immediately before `signOut()` calls `supabase.auth.signOut()` and cleared right after, lets the `onAuthStateChange` listener tell an *explicit* sign-out apart from a `SIGNED_OUT` event the SDK fired on its own (refresh failure, revoked session). Only the latter sets a new `sessionExpiredNotice: boolean` on the store. The Welcome screen checks this flag once on mount, shows a small calm banner ("Your session has ended. Please sign in again.") if set, and clears it — reusing the existing inline-banner pattern from `login.tsx`/`sign-up.tsx` rather than introducing a toast system.

### 3.8 Identity priority as one pure, tested function

A new `resolveDisplayName(profileName, authFullName, email)` in `src/utils/resolveDisplayName.ts` implements the exact priority from §13 (edited profile name → Supabase `full_name` → email local-part → a static "there"/"Spero User" fallback so it's never blank/`undefined`). Used in `home.tsx`'s greeting and `profile/index.tsx`'s header name. `(onboarding)/profile.tsx`'s Display Name field additionally pre-fills from `authStore.user.fullName` when the local profile name is still blank, so a fresh signup doesn't present an empty field the user didn't need to fill from scratch.

### 3.9 Error copy stays in the existing, extended `authErrors.ts`

`getAuthErrorMessage` gains cases for PKCE/deep-link failures (invalid or expired code, wrong-device code) and a broader network-failure match (RN's raw `TypeError: Network request failed` in addition to the existing 'network'/'fetch' substring checks), so §16's "distinguish bad credentials / unconfirmed email / network / server error" is one extended pure function, not new per-screen logic.

## 4. Files

| File | Change |
|---|---|
| `src/lib/supabase.ts` | Add `flowType: 'pkce'` |
| `src/utils/authDeepLink.ts` | New — `getAuthCallbackUrl()` |
| `app/auth/callback.tsx` | New — centralized code-exchange screen |
| `app/_layout.tsx` | Add `<Stack.Screen name="auth" />` |
| `src/store/authStore.ts` | Add `isPasswordRecovery`, `sessionExpiredNotice`, `completePasswordRecovery`, `updatePassword`, `resendConfirmationEmail`; extend listener |
| `src/utils/authRouting.ts` | Add `isPasswordRecovery` to `AuthRoutingState`, checked first in all three functions |
| `src/store/onboardingStore.ts` | `hasCompletedOnboarding` → `completedUserIds: string[]`; add `useHasCompletedOnboarding()` hook |
| `app/index.tsx`, `src/components/AuthGate.tsx`, `app/(auth)/login.tsx`, `app/(auth)/sign-up.tsx`, `app/auth/callback.tsx` | Read onboarding completion via `useHasCompletedOnboarding()` instead of the raw store field |
| `app/(onboarding)/wallet-setup.tsx` | `completeOnboarding()` → `completeOnboarding(userId)` |
| `app/(onboarding)/profile.tsx` | Pre-fill Display Name from `authStore.user.fullName` when blank |
| `app/(auth)/forgot-password.tsx` | Pass `redirectTo: getAuthCallbackUrl()` |
| `app/(auth)/sign-up.tsx` | Pass `emailRedirectTo`; add Resend + Open Email App to the confirmation state |
| `app/(auth)/reset-password.tsx` | New — New/Confirm Password screen |
| `app/(auth)/welcome.tsx` | Show/clear `sessionExpiredNotice` banner |
| `app/(app)/profile/security.tsx` | Real `updatePassword`; drop fake Current Password field |
| `src/utils/resolveDisplayName.ts` | New (TDD) |
| `app/(app)/home.tsx`, `app/(app)/profile/index.tsx` | Use `resolveDisplayName` |
| `src/utils/authErrors.ts` | Extend for PKCE/deep-link and broader network errors |

## 5. Explicitly out of scope (per phase brief §25)

`profiles`/`business_profiles`/`customers`/`payment_requests`/`request_events`/`transactions`/`templates` database tables, RLS for business/payment data, Supabase Storage, real blockchain/WalletConnect/USDC payments, transaction monitoring, real push notifications, account deletion.

## 6. Completion criteria

Matches phase brief §26: Forgot/Reset/Change Password work; email confirmation state + resend + confirmation deep link work; identity uses authenticated data with a clean fallback; onboarding completion is per-user; route guard considers session + onboarding + recovery; session expiry handled safely; auth errors are calm and specific; Phase 1 data untouched; `tsc` passes; existing tests pass; new auth tests pass; no regression.

## 7. Verification plan

- `npx tsc --noEmit`, `npx jest` after each task and at the end.
- Pure-function tests for `authRouting`'s new recovery branch, `resolveDisplayName`, and the extended `authErrors` cases; mocked-Supabase `authStore` tests for the new actions (`completePasswordRecovery`, `updatePassword`, `resendConfirmationEmail`, the recovery/expiry listener branches) and a new `onboardingStore` test suite for per-user isolation — matching this project's established convention of testing pure utils and stores, not screens (no screen-level tests exist anywhere in this codebase yet; not introduced here either).
- Manual scenario trace (code-level, no device) against phase brief §24's matrix.
- Final holistic review across the whole branch diff before merge, per established process.
