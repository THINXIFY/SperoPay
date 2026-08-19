# SperoPay — Phase 1B-2B: Mock Payment Engine, State Synchronization & Final Phase 1 Audit

Status: Approved
Date: 2026-08-20

## 1. Purpose

Turn the existing screens (built across Phase 1A, 1B-1, 1B-2A) into one coherent simulated payment product: a real mock payment lifecycle that mutates shared store state, propagates consistently to every screen that displays it, and a final audit across all of Phase 1. Still frontend-only/mock-local — no Supabase, real auth, Solana RPC, wallet providers, blockchain monitoring, or real USDC transfers. This is the final stage of Phase 1.

## 2. Scope

- A real `pending → confirming → paid` status lifecycle, driven from the existing Demo Payment screen
- Runtime `Transaction` creation (the store already exists from 1B-2A, currently read-only)
- Global synchronization: Home, Customer stats, Invoice, Receipt, Request Detail all reflect the same underlying state with zero duplicated/disconnected values
- A new Payment Success screen
- Duplicate-payment / expired / cancelled protection, enforced at the store layer (not just UI)
- A simple, testable payment-failure path
- Store-level and pure-function tests for the new lifecycle
- A final audit pass across theme, accessibility, navigation, brand, and full-flow regression for all of Phase 1

## 3. Architecture decisions

### 3.1 Add `'confirming'` as a real, permanent status

`PaymentRequestStatus` becomes `'pending' | 'confirming' | 'paid' | 'expired' | 'cancelled'`. This is a deliberate, spec-mandated choice (not a UI-only flourish) — every screen that displays request status must show `'confirming'` honestly rather than lying and calling it `'pending'`, so Invoice/Public Payment/Request Detail/Customer history all reflect one real state machine. `'payment_detected'` (already an existing `RequestEventType`) stays an event only, not a status — it fires once, mid-lifecycle, without needing its own permanent state.

Adding this status is a TypeScript-enforced ripple: `StatusBadge`'s `LABELS`/`COLOR_KEYS` (both `Record<PaymentRequestStatus, ...>`) will fail to compile until updated — this is treated as a feature, not friction, since it guarantees no status-display site is silently skipped. `'confirming'` reuses the existing `pending` (amber) color token rather than introducing a new theme color, keeping the visual system unchanged.

### 3.2 Pure orchestration logic, thin store wrappers

Following the codebase's established convention (TDD only applies cleanly to pure functions; no store has ever been unit-tested here), the actual guard/construction logic is extracted into new pure functions in `src/utils/paymentSimulation.ts`:

```ts
canBeginPaymentConfirmation(request): boolean   // true only if status === 'pending'
canCompletePayment(request): boolean            // true only if status === 'confirming'
buildTransaction(request, now?): Transaction    // pure construction, mirrors buildPaymentRequest
```

`requestStore` gains two thin actions that call these guards, mutate `requests`, and cross-call `transactionStore`/`requestEventStore` — following the exact cross-store `.getState()` call pattern `createRequest`/`cancelRequest` already use today:

```ts
beginPaymentConfirmation(id): boolean   // pending → confirming, logs 'payment_detected'
completePayment(id, options?): Transaction | null  // confirming → paid (+ Transaction + 'payment_confirmed'), or confirming → pending on simulated failure
```

This makes the guard logic (the actual "critical" duplicate/expired/cancelled protection) directly unit-testable without touching Zustand or AsyncStorage at all, while the store actions themselves stay thin enough that a light integration check (calling `.getState()` methods directly in a test — feasible since Zustand stores work standalone outside React) is enough to confirm the wiring, attempted in Task 5 with a documented fallback if AsyncStorage persistence causes first-time friction in this test setup.

### 3.3 Protection is enforced at the source, not just the UI

`beginPaymentConfirmation` only succeeds if `status === 'pending'`; `completePayment` only succeeds if `status === 'confirming'`. This means even if a screen's guard were somehow bypassed, no duplicate transaction or double status-flip can occur — the store itself refuses. UI-level guards (Demo Payment screen's blocked states for already-paid/confirming/expired/cancelled requests, Public Payment page hiding pay actions during `'confirming'`) exist for UX clarity on top of this, not as the only protection.

### 3.4 Failure path

A `completePayment(id, { forceFailure? })` override gives tests deterministic control. In the live UI, a small fixed-probability constant (`DEMO_PAYMENT_FAILURE_RATE`, documented as demo-only) occasionally reverts `'confirming'` back to `'pending'` instead of completing — no transaction is created, no `payment_confirmed` event fires, and the Demo screen shows "We couldn't confirm this payment. Try again." with a retry that re-enters the same flow (now safely, since the request is back to `'pending'`).

### 3.5 One simulation entry point, several synchronized readers

The simulation is driven entirely from `app/pay/demo.tsx`. Every other screen that shows request/transaction data (Invoice, Receipt, Request Detail, Public Payment page, Home, Customer Detail) already reads live from `requestStore`/`transactionStore`/`getCustomerStats` — confirmed during audit that Receipt, Invoice, and Customer Detail need **zero code changes** to reflect a payment once both `request.status` and a matching `Transaction` exist; they already derive everything live. The only screens needing new code are: `requestStore`/`transactionStore` (new actions), `app/pay/demo.tsx` (drives the lifecycle), `app/pay/[id].tsx` and `app/(app)/requests/[id].tsx` (need a `'confirming'` display branch, since neither had one), and `app/(app)/home.tsx` (its hero card was fully hardcoded, not live — this is fixed as part of this phase per the explicit "do not maintain stale hardcoded totals" instruction).

### 3.6 Payment Success screen

New `app/pay/success.tsx`, added to the existing `pay` route group (`app/pay/_layout.tsx`) — no new top-level segment, no tab-bar risk (same reasoning as 1B-2A's `pay` group placement). Reached only via `router.replace` from the Demo Payment screen after a successful `completePayment`, so it can't be reached for a request that isn't actually paid (guarded the same way Receipt is: `!request || request.status !== 'paid'`).

### 3.7 Merchant confirmation

Implemented as a plain `Alert.alert('Payment received', '{amount} from {customer}')`, fired the moment `completePayment` succeeds inside the Demo Payment screen's handler — reusing the exact `Alert.alert` pattern already used throughout the app (copy confirmations, etc.) rather than building new toast/notification infrastructure. This satisfies "local in-app feedback, no real push notification" without new UI plumbing.

### 3.8 Home hero card

Replaces the fully-hardcoded `HERO_AMOUNT`/`HERO_GROWTH`/`HERO_SUPPORTING` constants with a live sum of `transactionStore.transactions` whose `paidAt` falls in the current calendar month. The fabricated `+18.6%` growth percentage is dropped rather than replaced with another invented figure — there is no real "last month" mock data to honestly compare against, so inventing a second fake number to preserve a growth pill would violate the same "no stale/fake totals" instruction it's meant to fix. It's replaced with a live payment count for that month. `paidCount`/`pendingCount`/`recentActivity` were already live in 1B-2A's baseline; `recentActivity`'s sort key changes from `createdAt` (when the request was created) to the paid transaction's `paidAt` when available (when it was actually paid) — otherwise a freshly-simulated payment on an old request wouldn't surface at the top, which contradicts the audit's own account of what "recent" should mean.

## 4. Screens

| Route | Change |
|---|---|
| `app/pay/demo.tsx` | Rewrite — status-gated blocked states, staged lifecycle simulation, failure/retry path, merchant confirmation, navigates to success |
| `app/pay/success.tsx` | New — Payment Success screen |
| `app/pay/_layout.tsx` | Modify — add `success` to the enumerated Stack.Screen list |
| `app/pay/[id].tsx` | Modify — add `'confirming'` branch (hide pay actions) |
| `app/(app)/requests/[id].tsx` | Modify — add `'confirming'` action block, add Paid Date/Transaction detail rows for paid requests |
| `app/(app)/home.tsx` | Modify — live hero card, `recentActivity` sorts by paid time |
| `app/(app)/requests/index.tsx` | Modify — add "Confirming" filter chip |
| `src/components/StatusBadge.tsx` | Modify — add `'confirming'` to `LABELS`/`COLOR_KEYS` |
| `src/utils/getDateLabel.ts` | Modify — add `'confirming'` branch |
| `src/utils/getCustomerStats.ts` | Modify — `outstanding` includes `'confirming'` alongside `'pending'` |
| `app/request/receipt.tsx` | Modify — extract local `truncateHash` into a shared util (used by the new success screen too) |

## 5. Data model additions

- `PaymentRequestStatus` gains `'confirming'` (`src/types/payment.ts`)
- `src/utils/paymentSimulation.ts` — `canBeginPaymentConfirmation`, `canCompletePayment`, `buildTransaction`, `DEMO_PAYMENT_FAILURE_RATE` (new, TDD)
- `src/utils/ids.ts` — new `generateTxHash()` (new, TDD)
- `src/utils/truncateHash.ts` — extracted shared util (new)
- `src/store/requestStore.ts` — new actions `beginPaymentConfirmation`, `completePayment`
- `src/store/transactionStore.ts` — new action `addTransaction` (rename `_set` back to `set`)

No new stored entities beyond what 1B-2A already introduced (`Transaction` via `transactionStore`) — this phase makes that store genuinely writable, per its own design doc's stated intent.

## 6. Explicitly out of scope (per phase spec §28)

Supabase, real authentication, Solana RPC, Helius/QuickNode/Alchemy, Phantom/WalletConnect, real USDC, blockchain monitoring, webhooks, private keys/seed phrases, custodial wallets, real push notifications, real PDF backend, POS/API/teams/accounting.

## 7. Completion criteria

Matches phase spec §29: payment simulation, transaction creation, request transitions, timeline updates, Home/customer/invoice/receipt synchronization, duplicate/expired/cancelled protection, Payment Success, tests, TypeScript, light/dark polish, accessibility, clean navigation, no regressions across Phase 1A/1B-1/1B-2A.

## 8. Verification plan

- `npx tsc --noEmit`, `npx jest` after each task and at the end
- Store-level guard tests (pure functions) plus an attempted direct-store integration test, per §3.2
- Route-tree verification confirming `success` collapses correctly under `pay` with no phantom-tab leakage
- Full walkthrough trace (code-level, no device) matching phase spec §22's flow list
- Final holistic review across the whole branch diff before merge, per established process
