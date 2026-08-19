# SperoPay — Phase 1B-2A: Invoice, Receipt, Public Payment Experience & Demo Payment UI

Status: Approved
Date: 2026-08-19

## 1. Purpose

Build the customer-facing and document side of the payment experience on top of Phase 1A + Phase 1B-1's existing architecture: Invoice, Receipt, a public (no-account) Payment Request page, a QR payment section, and a "Demo Pay with Wallet" mock entry flow. Still frontend-only with mock/local state — no Supabase, real auth, Solana RPC, wallet providers, blockchain monitoring, or real USDC transfers.

Brand rule carried forward: **Spero** for in-app/everyday UX ("Pay with Spero"), **SperoPay** for formal document/product contexts (invoice/receipt headers).

## 2. Scope

- Invoice screen, derived from an existing `PaymentRequest` + `Customer` + `Profile`
- Receipt screen, available only for `status: 'paid'` requests
- Public Payment Request page (no Spero account required)
- QR payment section (code, amount, wallet, copy actions, network warning)
- Demo "Pay with Wallet" entry flow, stopping at a prepared processing-entry state
- Paid / Expired / Cancelled public-facing states
- Invoice/Receipt sharing via existing native share pattern
- Light/Dark theme support on every new screen

Explicitly deferred to Phase 1B-2B: the full payment simulation engine (pending → confirming → paid), `Transaction` *creation* at runtime, Home/customer total synchronization, automatic Paid transitions, and real duplicate-payment behavioral protection (this phase is UI/display only for those states).

## 3. Architecture decisions

### 3.1 No new stored "Invoice"/"Receipt" entities

Per the existing project rule (avoid duplicate state), Invoice and Receipt are **views**, not stores. All fields are derived live from `PaymentRequest`, `Customer`, `Profile`, `Wallet`, and (new) `Transaction`. Invoice ID and Receipt ID are pure derivations of the request's existing `paymentCode`:

```ts
getInvoiceId(request) => `INV-${request.paymentCode}`   // e.g. INV-SP-A82KD
getReceiptId(request) => `RCP-${request.paymentCode}`   // e.g. RCP-SP-A82KD
```

No new ID generator is needed — `paymentCode` already exists on every request.

### 3.2 Wire up the existing (currently dead) `Transaction` type

`src/types/payment.ts` already defines `Transaction { id, requestId, amount, currency, network, fromCustomerId, txHash, paidAt }`, but nothing creates, stores, or reads one today — "paid" mock requests carry no paid-date or transaction hash anywhere. The design spec itself names `Transaction` as an intended source for document data (§19), so Phase 1B-2A wires it up properly instead of bolting ad-hoc fields onto `PaymentRequest`:

- New `src/data/transactions.ts` — 3 mock `Transaction` records, one per existing paid mock request (`req-1`, `req-5`, `req-6`), using each request's real `payment_confirmed` event timestamp as `paidAt` for internal consistency with the existing timeline seed data.
- New `src/store/transactionStore.ts` — persisted (`speropay/transactions`), read-only for this phase: `{ transactions: Transaction[], getTransactionForRequest(requestId): Transaction | undefined }`. No `addTransaction` action yet — that arrives in Phase 1B-2B alongside the simulation engine that would call it.

This keeps `PaymentRequest` unchanged and gives Phase 1B-2B a store to write into rather than a type migration.

### 3.3 Route placement — reuse existing groups, add one new public group

Confirmed via audit: `app/request/` (the Smart Request creation flow: `amount`, `details`, `created`) already has its own `_layout.tsx` with an **explicitly enumerated** `<Stack.Screen>` list (not the auto-registering `<Stack />` pattern used by `(app)/requests` etc.). Neither `app/request/` nor any new segment here nests inside the `(app)` Tabs group, so none of this can reintroduce the Phase 1B-1 phantom-tab bug.

- **Invoice & Receipt** (`app/request/invoice.tsx`, `app/request/receipt.tsx`) — merchant-facing, viewed from within the app for an existing request. Added to `app/request/_layout.tsx`'s existing enumerated `<Stack.Screen>` list, same pattern as `amount`/`details`/`created`. Accessed via `?id=` query param, matching `created.tsx`'s existing convention.
- **Public Payment Page** (`app/pay/[id].tsx`) — must work without a Spero account. New top-level segment, own `_layout.tsx` (explicitly enumerating `[id]` and `demo`), registered as a new `<Stack.Screen name="pay" />` in the root `app/_layout.tsx` (regular push, not modal — it should feel like navigating to a distinct page, not opening a sheet, matching how a customer would actually experience it).
- **Demo Payment** (`app/pay/demo.tsx`) — sibling of `[id]` under the same `pay` group, reached only from the public page's "Pay with Wallet" CTA. Accessed via `?id=`.

Since this is a single local mock app with one Zustand instance (no real multi-user backend), the "public" page reads the same local stores as the merchant-facing screens — there is no real customer/merchant session separation to build. This is called out explicitly as a known, appropriate simplification for mock/local scope, not an oversight.

### 3.4 Component reuse

- `StatusBadge` already covers all four `PaymentRequestStatus` values — reused as-is for the Invoice's status row (no new badge component needed).
- `QRCodeCard` gets added to the `src/components/index.ts` barrel (it exists today but is only ever imported by relative path) since Phase 1B-2A reuses it in a second location (public payment page QR sheet).
- `ThemeAwareCard`, `PrimaryButton`, `SecondaryButton`, `IconButton`, `AppHeader`, `AppBottomSheet`, `Logo`, `EmptyState` are reused unmodified.
- Two new pure, TDD'd share-message builders — `buildInvoiceShareMessage`, `buildReceiptShareMessage` — follow the exact pattern already established by `buildReminderMessage`.

### 3.5 Demo Payment stopping point

Per the phase's explicit boundary: tapping **Pay with Wallet** on the public page navigates to a clearly labeled "Demo Payment" screen ("This is a simulated payment for the Spero prototype. No real funds will move."). Tapping **Continue** flips local component state to a "Preparing your payment…" processing view (spinner + explanatory copy). **No store is mutated** — the request's status never changes, no `Transaction` is created, nothing elsewhere in the app updates. This is the "prepared payment-processing entry state" the phase spec explicitly allows stopping at; the real progression belongs to Phase 1B-2B. A back action is included so the screen isn't a dead end (basic navigability, not scope creep).

### 3.6 Invoice/Receipt access points

- `app/request/created.tsx` — new `SecondaryButton "View Invoice"` below the existing `PrimaryButton "Share Link"`.
- `app/(app)/requests/[id].tsx` — new `SecondaryButton "View Invoice"`, always rendered (not status-gated, since an invoice is the request document regardless of payment state) placed just above the existing status-conditional action blocks. The existing paid-status `Alert.alert('Receipt', 'Receipts are coming in a future update.')` stub is replaced with real navigation to `/request/receipt?id=...`.
- Customer Detail (`customers/[id].tsx`) is intentionally **not** modified — its history rows already navigate to Request Detail, which now carries real Receipt access for paid items. Adding a second, parallel receipt entry point there would duplicate navigation for no real benefit at this scope.
- Public Payment Page's Paid state includes an optional `SecondaryButton "View Receipt"` navigating to the same `/request/receipt?id=...` screen (reused as-is; no separate "public" receipt view needed since there's no real auth boundary to protect it from).
- Invoice screen itself includes `SecondaryButton "View Payment Request"` → `router.push(\`/pay/${request.id}\`)`.

### 3.7 Loading / error / unavailable states

Each new screen (`invoice.tsx`, `receipt.tsx`, `pay/[id].tsx`, `pay/demo.tsx`) guards against a missing/invalid `id` with an `EmptyState` using the phase spec's literal copy ("We couldn't load this invoice.", "We couldn't load this receipt.", "This payment request is no longer available."). Receipt additionally treats a valid-but-unpaid request the same as not-found, matching "Receipt should only be accessible for Paid requests." No new shared hook is introduced for this — each screen's existing `if (!request) {...}` early-return pattern (already used in `created.tsx`/`[id].tsx`) is extended with the same condition, consistent with the codebase's existing per-screen guard style.

## 4. Screens

| Route | Change |
|---|---|
| `app/request/invoice.tsx` | New — Invoice document view |
| `app/request/receipt.tsx` | New — Receipt document view (paid-only) |
| `app/request/_layout.tsx` | Modify — add `invoice`, `receipt` to the enumerated `<Stack.Screen>` list |
| `app/request/created.tsx` | Modify — add "View Invoice" entry point |
| `app/(app)/requests/[id].tsx` | Modify — add "View Invoice" entry point, wire real "View Receipt" navigation |
| `app/pay/_layout.tsx` | New — Stack layout, enumerates `[id]`, `demo` |
| `app/pay/[id].tsx` | New — Public Payment Request page (pending/paid/expired/cancelled/not-found states, QR sheet) |
| `app/pay/demo.tsx` | New — Demo Pay with Wallet flow |
| `app/_layout.tsx` | Modify — register new `pay` Stack.Screen |
| `src/components/index.ts` | Modify — export `QRCodeCard` |

## 5. Data model additions

- `src/data/transactions.ts` — 3 mock `Transaction` records (new)
- `src/store/transactionStore.ts` — new persisted store, read-only this phase (new)
- `src/utils/documentIds.ts` — `getInvoiceId`, `getReceiptId` (new, TDD)
- `src/utils/buildInvoiceShareMessage.ts` (new, TDD)
- `src/utils/buildReceiptShareMessage.ts` (new, TDD)

No changes to `src/types/payment.ts` — `Transaction` already has every field needed.

## 6. Explicitly out of scope (per phase spec §25)

Full payment simulation engine, pending→confirming→paid synchronization, `Transaction` creation at runtime, Home/customer total updates, automatic Paid transition, payment-success global state sync, Solana RPC, real wallets, real blockchain, Supabase, real USDC payments.

## 7. Completion criteria

Matches phase spec §26: Invoice UI works and derives correctly; Receipt UI works for paid mock requests; Public Payment page works with all 4+1 states (pending/paid/expired/cancelled/not-found); QR section works; Demo Pay with Wallet entry works and stops cleanly; Invoice/Receipt sharing works; mock links consistent (`pay.speropay.app`, `SP-`/`INV-SP-`/`RCP-SP-` prefixes); Light/Dark theme consistent; navigation clean (no phantom tabs); TypeScript passes; existing tests remain passing; no regressions in Phase 1A/1B-1.

## 8. Verification plan

- `npx tsc --noEmit`, `npx jest` after each task and at the end
- Route-tree verification (expo-router `getRoutes()`) confirming the new `pay` group does not leak into the `(app)` Tabs route list
- Code-level audit (no device available): hardcoded colors, safe areas, keyboard handling, accessibility labels
- Manual regression pass against Phase 1A/1B-1's feature list
- Final holistic review across the full diff before merge, per established process
