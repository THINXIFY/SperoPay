# SperoPay — Phase 2B: Real Supabase Database, Per-User Data Isolation & Cloud Persistence

Status: Approved
Date: 2026-08-21

## 1. Purpose

Migrate Requests, Customers, Templates, Transactions, Request Events, Profile, Business Profile, and Wallet from local Zustand+AsyncStorage (one global blob per device) to Supabase Postgres, owned per-user and enforced by RLS. Closes the real bug this phase names explicitly: a second user signing in on the same device currently inherits the first user's business/customer/request data. The mock payment engine, invoice/receipt derivation, and all existing screen UX are preserved exactly — this is a persistence-layer migration, not a redesign.

## 2. Audit findings that drive this design

- **`Profile` and `Wallet` have no owner field at all today** — each is a single implicit-owner blob (`profileStore.profile`, `walletStore.wallet: Wallet | null`), which is *why* cross-user leakage is possible: nothing on the record itself says whose it is.
- **`website` is one shared field, not two.** `(app)/profile/edit.tsx` and `(app)/profile/business.tsx` both call `useProfileStore.updateProfile({ website, ... })` against the *same* flat `Profile` object — there is exactly one website value today, edited from two screens. The phase brief's suggested schema puts `website` on both `profiles` and `business_profiles`; splitting it into two independently-editable values would be a behavior change, not a migration. Decision: `website` lives on `business_profiles` only; the profile store's public shape (`profile`, `updateProfile(patch)`) stays a single merged object so **zero screen code changes** — `updateProfile` internally routes each field to the right table.
- **The "public" payment page has no real access-control boundary today — confirmed by direct audit, not assumption.** `app/pay/[id].tsx`, `app/pay/demo.tsx`, and `app/pay/success.tsx` all read `useRequestStore`/`useCustomerStore`/`useProfileStore`/`useWalletStore`/`useTransactionStore` directly, with no ownership check anywhere. It has only ever "worked" because the app is a single local process — the "customer" and the "merchant" are the same device, same in-memory store. `demo.tsx` goes further: it calls `beginPaymentConfirmation`/`completePayment` — the exact same mutations the owner uses — directly from this screen. There is no existing public-access mechanism to preserve; one would have to be *built*, and the phase brief explicitly says not to (§21: "do not accidentally pretend it is truly public," "do NOT weaken RLS to expose all payment requests publicly," defer genuine public access to the real-payment/checkout phase). Full reasoning and decision in §3.7.
- **`payment_link` is cosmetic text, not a working route.** `buildPaymentRequest.ts` sets it to `https://pay.speropay.app/r/${id}` — a domain this app doesn't serve. Real in-app navigation to the pay page uses `router.push('/pay/${request.id}')`, a completely separate mechanism. This matters for §3.6 below.
- **`generateId()` produces non-UUID strings** (`${Date.now().toString(36)}-${random}`). The brief wants UUID primary keys; Postgres will generate them (`gen_random_uuid()` default) rather than the client.
- **Cross-store writes are already centralized in `requestStore.ts`**, not scattered across screens — `createRequest`/`cancelRequest`/`deleteRequest`/`beginPaymentConfirmation`/`completePayment` are the only places that call `useRequestEventStore.getState()`/`useTransactionStore.getState()`. This is exactly the multi-write/one-logical-action surface §16 asks about, and it's small and well-bounded.
- **`requestDraftStore` and `paymentDefaultsStore` are not persist-migration targets.** The draft store isn't even `persist`-wrapped (pure in-session scratch state); payment defaults, notifications, security, and theme preferences aren't in the brief's table list (§3) and are reasonably "local preference" per §17 — left untouched.
- **Mock avatar/logo fields (`'mock-avatar'`, `'mock-logo'`) are sentinel strings, not real uploads.** No image-picker or Storage integration exists to migrate; §8's "defer logo upload" applies by default, not by choice.
- **Existing Zustand stores currently seed from `src/data/*.ts` mock arrays** (`customers: mockCustomers`, `requests: mockRequests`, etc.) — this is §25's concern in concrete form. It resolves automatically once these stores fetch from Supabase instead of initializing from the mock arrays: a brand-new user's tables genuinely have zero rows. The mock data files are left in place (harmless, unused) rather than deleted, since deleting them isn't required and several existing tests reference them.
- Ran `npx tsc --noEmit` and `npx jest` on the fresh worktree before starting: clean, 22 suites / 140 tests passing.

## 3. Architecture decisions

### 3.1 Schema follows the brief's tables, with named deviations where the app's actual types differ

Full DDL is in the plan. Deviations from the brief's example schema, and why:
- `payment_requests.currency`, not `display_currency` — the app has no settlement-vs-display currency distinction yet; inventing one would be speculative.
- `request_events.occurred_at`, not `created_at` — matches the existing `RequestEvent.occurredAt` field exactly.
- `payment_templates` has no `stablecoin`/`network` columns — the current `Template` type doesn't have them either (USDC/Solana is implied everywhere); adding unused columns would be speculative.
- `transactions.from_customer_id` is kept (the brief's example omits it) — it's on the current `Transaction` type and cheap to preserve exactly rather than risk a behavior change by dropping it.
- Per §2's finding, `business_profiles.website` is the only `website` column; `profiles` has none.

### 3.2 Every user-owned table gets `user_id uuid not null references auth.users(id) on delete cascade`, plus RLS with one policy shape reused everywhere

```sql
alter table public.<table> enable row level security;

create policy "<table>_select_own" on public.<table>
  for select using (auth.uid() = user_id);
create policy "<table>_insert_own" on public.<table>
  for insert with check (auth.uid() = user_id);
create policy "<table>_update_own" on public.<table>
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "<table>_delete_own" on public.<table>
  for delete using (auth.uid() = user_id);
```
`profiles.id` *is* `auth.users.id` (one row per user, no separate `user_id` column needed there); every other table gets an explicit `user_id`. No table is ever queried by a service-role key from the client — the anon key + RLS is the only access path, matching Phase 2A's established security posture.

### 3.3 Multi-write actions become Postgres functions (`SECURITY INVOKER`, RLS still applies inside them), not client-side sequences

`createRequest` (request + `created` event), `beginPaymentConfirmation` (status→confirming + `payment_detected` event), `completePayment` (transaction insert + status→paid + `payment_confirmed` event, or status stays pending + `payment_failed` event on the simulated-failure branch), and `cancelRequest` (status→cancelled + `cancelled` event) each become one `create or replace function public.fn_name(...) returns ... language plpgsql security invoker` call, so a partial failure can't leave a request without its event or a transaction without its status flip. `deleteRequest` does **not** need a function — `ON DELETE CASCADE` on `request_events.payment_request_id` and `transactions.payment_request_id` means a plain RLS-guarded `DELETE FROM payment_requests` already removes both atomically; adding an RPC for it would be exactly the "overengineer simple CRUD" §16 warns against.

Functions are `SECURITY INVOKER`, not `SECURITY DEFINER` — see §3.7 for why no privilege escalation is needed anywhere in this phase.

### 3.4 `profileStore` becomes a merged read of two tables, with the *same public interface* it has today

`profile: Profile | null`, `updateProfile(patch)`. Internally: `fetchProfile()` does `select` on `profiles` and `business_profiles` (by `id`/`user_id` respectively) and merges them into the existing flat `Profile` shape; `updateProfile(patch)` splits the patch by field and writes to whichever table each field belongs to (§2). `edit.tsx`, `business.tsx`, `(onboarding)/profile.tsx`, and `(onboarding)/usage-type.tsx` need **no changes** — they already only ever call `profile` (read) and `updateProfile`/`setUsageType` (write).

### 3.5 Onboarding completion moves into `profiles.onboarding_completed`, which becomes a new async hydration gate

This is the one place the migration genuinely changes app *timing*, not just storage: routing used to wait only on local AsyncStorage rehydration (synchronous-ish, fast); it now waits on a network fetch. `profileStore` gains a `status: 'idle' | 'loading' | 'loaded' | 'error'`. A single effect in `app/_layout.tsx` (alongside the existing `initializeAuthListener()` call) watches `authStore.user?.id`: on a new (or first) id, calls `profileStore.getState().loadForUser(id)` (fetch, or create the minimum valid profile row if none exists yet, per §6 of the brief); on `id` becoming `null` (sign-out), calls `resetAllUserData()` (§3.8). `app/index.tsx`'s splash gate and `AuthGate` both switch from reading `useHasCompletedOnboarding()` (2A-2's per-user-array hook, now removed) to `profileStore.profile?.onboardingCompleted` — and both add `profileStore.status !== 'idle' && profileStore.status !== 'loading'` to their hydration gate, the same two-gate pattern already established for the auth/onboarding-store gate in 2A-1/2A-2.

### 3.6 `payment_link` is computed from `payment_code`, not the row id — a one-line, invisible deviation

Since (§2) `payment_link` never resolves as a real URL in this app, and `payment_code` (unlike the Postgres-generated `id`) is already known client-side before the insert, `buildPaymentRequest`'s replacement computes `payment_link` from `payment_code` instead of `id`. This avoids an awkward insert-then-update round trip for a field nobody ever navigates through, with zero visible behavior change (same format, same fake domain, still never actually resolves).

### 3.7 The public payment page's backend is explicitly deferred — not migrated, not weakened

Per §2's audit finding: there is no existing public-access mechanism to preserve. `app/pay/[id].tsx`, `demo.tsx`, and `success.tsx` are left reading the same Zustand stores as the authenticated owner, **unchanged**. Post-migration, those stores are populated by fetching *the signed-in user's own* rows from Supabase — so these three screens continue to work exactly as they do today, for exactly the same audience they've ever actually served: the owner's own signed-in device previewing/demoing their own request. A genuinely different, unauthenticated visitor on a second device gains nothing and loses nothing, because RLS means their client never had a way to load someone else's `payment_requests`/`customers`/`profiles`/`wallets` rows in the first place — today's version only "worked" for a stranger because it never really ran on a stranger's device. Building real public/no-account access (a share-token scheme, a `SECURITY DEFINER` RPC scoped to safe fields, or an Edge Function) is deferred to the real-payment/public-checkout phase, exactly as §21 anticipates. This is documented prominently in the final report, not silently dropped.

### 3.8 Cross-user isolation: RLS is the enforcement; a central reset is the UX backstop

RLS alone already prevents User B from ever receiving User A's rows over the network — that's the real guarantee. But leftover *client-side cache* (Zustand state from A's session) must not flash on screen before B's fetch resolves. `resetAllUserData()` (called on sign-out, and defensively before every `loadForUser(id)` call in case of an unexpected id change without an intervening sign-out) synchronously clears every Supabase-backed store's array/object back to its empty initial state, before any new fetch starts. Each domain store's `reset()` is trivial (`set({ items: [], status: 'idle' })`); `resetAllUserData()` in a new `src/store/dataLifecycle.ts` just calls all of them plus `profileStore.reset()`/`walletStore.reset()`.

### 3.9 Loading/error UX: one small set of reusable pieces, not one-off per screen

Every Supabase-backed store exposes the same `status`/`error` shape. Screens that list data (`requests/index.tsx`, `customers/index.tsx`, `profile/templates.tsx`) show a spinner while `status === 'loading'` and a calm inline retry message on `status === 'error'` — reusing the existing `EmptyState` component (already used for "no results" states) with an error variant, rather than introducing a new component family. Error copy is mapped through a small `getDataErrorMessage(error, context)` util (mirrors `authErrors.ts`'s established pattern) so raw Postgres errors never reach the UI.

### 3.10 Zustand's role after migration

Kept local, unchanged: `requestDraftStore`, `paymentDefaultsStore`, `notificationStore`, `securityStore`, `themeStore`. Migrated to Supabase-backed (fetch + mutate through `supabase-js`, cached in Zustand for the current session only, no `persist` middleware — AsyncStorage must not hold a second, divergent copy of cloud data): `profileStore`, `walletStore`, `customerStore`, `requestStore`, `requestEventStore`, `templateStore`, `transactionStore`. Removing `persist` from these seven is itself part of closing the cross-user leak — an AsyncStorage-persisted copy is exactly the "unrelated persisted copy that can diverge" §17 warns against.

## 4. Files (schema + representative store; full list in the plan)

| File | Change |
|---|---|
| `supabase/migrations/0001_phase2b_schema.sql` | New — all 8 tables, indexes, constraints |
| `supabase/migrations/0002_phase2b_rls.sql` | New — RLS enable + policies, all tables |
| `supabase/migrations/0003_phase2b_functions.sql` | New — `create_payment_request`, `begin_payment_confirmation`, `complete_payment`, `cancel_payment_request` |
| `src/store/dataLifecycle.ts` | New — `resetAllUserData()` |
| `app/_layout.tsx` | Add the user-id-watching bootstrap/reset effect |
| `src/store/profileStore.ts`, `walletStore.ts`, `customerStore.ts`, `requestStore.ts`, `requestEventStore.ts`, `templateStore.ts`, `transactionStore.ts` | Rewritten — Supabase-backed, `persist` removed |
| `src/store/onboardingStore.ts` | Removed — superseded by `profiles.onboarding_completed` |
| `src/utils/authRouting.ts`, `app/index.tsx`, `src/components/AuthGate.tsx` | `hasCompletedOnboarding` source switches to `profileStore` |
| `src/utils/getDataErrorMessage.ts` | New (TDD) |
| `src/utils/buildPaymentRequest.ts` | `payment_link` from `payment_code` (§3.6); id no longer client-generated |
| Requests/Customers/Templates screens | Loading/error states added; CRUD calls unchanged in shape |
| `app/pay/[id].tsx`, `demo.tsx`, `success.tsx` | Unchanged (§3.7) |

## 5. Explicitly out of scope (per phase brief §30)

Real Solana RPC/Helius/QuickNode/Alchemy, real transaction detection, Phantom/WalletConnect, real USDC execution, blockchain webhooks, production public checkout backend, real push notifications, POS/API/Teams/accounting integrations, Storage-backed avatar/logo upload.

## 6. Completion criteria

Matches phase brief §31: migrations + RLS exist; profile/business profile/wallet/onboarding/customers/templates/requests/events/transactions are per-user and Supabase-backed; cross-user leakage eliminated (RLS + reset); no divergent AsyncStorage copies of migrated domains remain; invoice/receipt and the mock payment flow still work; `tsc`/tests pass; Phase 2A auth not regressed.

## 7. Verification plan

- `npx tsc --noEmit`, `npx jest` after each domain and at the end.
- Mocked-Supabase-client tests for every store (matching the established `authStore.test.ts` pattern) — ownership scoping, cross-user reset, CRUD, duplicate-payment guard still enforced. No automated test depends on a live Supabase project.
- SQL/manual RLS verification steps (two real accounts, run in the Supabase SQL editor / app) for customers, wallets, payment_requests, transactions — provided in the final report per phase brief §28, since this genuinely requires two live authenticated sessions I cannot create myself.
- Final holistic review across the whole branch diff before merge, per established process.
