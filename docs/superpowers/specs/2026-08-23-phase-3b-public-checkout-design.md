# Phase 3B: Secure Anonymous Public Checkout — Design

## Web feasibility (spec section 3) — resolved, not deferred

`react-native-web`, `react-dom`, and `@expo/metro-runtime` were not installed — `npx expo export -p web` failed before this phase. Installed the standard Expo web trio (`npx expo install`, SDK-compatible versions) and re-ran the export: **it now succeeds cleanly** (1747 modules, one harmless `@noble/hashes` subpath-exports warning, non-fatal). This resolves section 3 in favor of building a real Expo Router web route rather than the "document the gap" fallback branch.

**Per section 46's mandatory disclosure**: this is *implementation complete* and *locally verified* (the export succeeds and produces a working static bundle on this machine). It is **not** deployed — no hosting, DNS, or domain configuration exists for `pay.speropay.app` or any other public URL. The final report will state this distinction explicitly, not just once here.

## Decision 1 — a new route, not a rewrite of `/pay/[id]`

The audit found `app/pay/[id].tsx` + `demo.tsx` + `success.tsx` are not actually a broken *public* flow — they're the **merchant's own mock "simulate a payment" tool**, only ever reachable and functional from the merchant's own authenticated session (`demo.tsx`'s `handleContinue` does `if (!userId) return;`, silently no-op-ing for anyone without a session). Rewriting these in place would conflate two genuinely different things: a merchant-side dev/demo simulator, and a real anonymous payer-facing page.

**Decision**: leave `app/pay/*` untouched (matches spec section 43's "don't touch unnecessarily" and minimizes regression risk on an already-working merchant tool). Add a **new** route group, `app/p/[token].tsx` + `app/p/_layout.tsx`, mapping to canonical path `/p/:token` — closely matching spec section 2's own suggested shape. Registered as a new sibling `Stack.Screen` in `app/_layout.tsx`, exactly like `pay`/`request`/`(app)` already are. No `AuthGate` wraps it, matching the audit's finding that `app/pay/_layout.tsx` already has none — confirmed that omission is what makes a route anonymous-routable in this app's architecture, not a special bypass mechanism.

## Decision 2 — the link-generation timing problem

`buildPaymentRequestPayload` currently constructs `paymentLink` **client-side, before** `create_payment_request` is even called — necessary because `payment_link` is passed *into* that RPC as an argument (a deliberate Phase 2B choice: derive from the client-generated `payment_code` up front, avoid an insert-then-update round trip). But the new `public_token` is a **server-generated** `gen_random_uuid()` default — it doesn't exist until *after* the insert. The client can no longer pre-compute the correct public URL before creating the request.

**Decision**: stop treating the stored `payment_link` column as the source of truth for the public checkout URL. Instead, always derive it fresh from `public_token` at display time, via one centralized `getPublicPaymentUrl(publicToken)` helper (spec section 25), wherever a link is shown (Request Created, Request Detail, Invoice, Receipt). This requires no migration — `create_payment_request` already `returns public.payment_requests` (the whole row), so once `public_token` exists as a column, the RPC's response includes it for free. Just needs `requestStore.ts`'s row mapper and the `PaymentRequest` type to expose it, and every current `request.paymentLink` read-site to switch to `getPublicPaymentUrl(request.publicToken)`. The old `payment_link` DB column and the old `/r/<code>` shape are left in place but no longer used for anything new — not worth a migration to remove given nothing currently depends on that column's *value* being correct (it never was — the audit confirmed it already pointed nowhere).

## Base URL configuration

`getPublicPaymentUrl` reads `EXPO_PUBLIC_CHECKOUT_BASE_URL`; if unset, falls back to `https://pay.speropay.app` — the already-established brand domain (used elsewhere, e.g. `support@speropay.app`), not a random placeholder, but **explicitly documented as aspirational, not deployed** in `.env.example` and this phase's final report. A production build would set the real env var once a domain actually exists.

## Public data source

`src/services/publicCheckout/` (`publicCheckoutService.ts`, `types.ts`, `errors.ts`) — validates the token is UUID-shaped before querying (fail fast on obviously-malformed input without a network round trip), calls `supabase.rpc('get_public_payment_request', { p_token: token })` using the existing shared `supabase` client (audit confirmed: no separate anonymous client is needed — the anon key already authenticates as `anon`, and RLS/grants already permit this one function), normalizes the row into a clean domain type, and maps every failure mode (malformed token, RPC returned no row, network/RPC error) into a structured, UI-safe error — never a raw Supabase error string. Zero dependency on `requestStore`/`profileStore`/`walletStore`/any merchant-authenticated state, satisfying spec section 4 directly.

## Status handling & polling

Recursive `setTimeout` (not `setInterval`) so a slow response can never overlap with the next poll — schedule the next fetch only after the current one resolves. Polls only while status is `pending`/`confirming`; stops entirely on `paid`/`expired`/`cancelled`; cleaned up on unmount. ~7s interval (within the spec's suggested 5-10s range).

## What this phase does not do

No wallet-connect/Phantom/signing, no Solana Pay URI construction (the QR continues to encode the checkout page URL itself, clearly labeled as such — not a payment URI, which is explicitly Phase 3C), no real payment-marking path (the checkout page has no button that can flip status locally), no changes to the Phase 3A blockchain service layer.
