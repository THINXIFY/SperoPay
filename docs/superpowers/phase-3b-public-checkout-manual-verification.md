# Phase 3B — Public Checkout Manual Verification

Run once migration `0005_phase3a_payment_foundation.sql` has been applied (it created `payment_requests.public_token` and `get_public_payment_request`). No new migration ships with Phase 3B.

## Setup
1. Sign in as an existing account (or create one), set a wallet address, and create one payment request. Note its id.
2. In the SQL Editor (service role — this bypasses RLS, so it's ground truth), find the request's token:
   ```sql
   select id, public_token, payment_code from public.payment_requests where id = '<request id>';
   ```
3. Note both the `id` (internal, should never be exposed publicly) and `public_token` (the value the `/p/<token>` link is built from).

## Verification A: anonymous caller cannot read `payment_requests` directly
Using `supabase-js` with the **anon key only** (no session — this simulates a signed-out browser hitting the public checkout page):
```ts
const { data, error } = await supabase.from('payment_requests').select('*').eq('public_token', '<public_token>');
```
Expected: `data` is `[]` (RLS's `payment_requests_select_own` policy requires `auth.uid() = user_id`; an anonymous caller has no `auth.uid()`, so it always evaluates false — zero rows, not an error). This confirms the public checkout page cannot fall back to a direct table query even by accident.

## Verification B: the RPC returns only the sanitized shape for a valid token
Still using the anon key only:
```ts
const { data, error } = await supabase.rpc('get_public_payment_request', { p_token: '<public_token>' });
```
Expected: one row containing exactly `payment_code, amount, currency, network, description, status, expires_at, merchant_name, destination_wallet`. Confirm the row does **not** contain `id`, `user_id`, or `customer_id` — `get_public_payment_request`'s `returns table (...)` in `0005_phase3a_payment_foundation.sql` only ever selects those 9 columns, so there is no field to accidentally leak.

## Verification C: an invalid or unknown token returns nothing, not an error
Still anon key only:
```ts
await supabase.rpc('get_public_payment_request', { p_token: '00000000-0000-0000-0000-000000000000' }); // well-formed UUID, no matching row
```
Expected: `data` is `[]`, `error` is `null`. The service layer (`fetchPublicCheckout` in `src/services/publicCheckout/publicCheckoutService.ts`) maps this to `{ ok: false, code: 'not_found' }` and the checkout page shows a generic "Payment link unavailable" state — never a raw Postgres/PostgREST error message.

Also confirm client-side rejection for a malformed token never reaches the network:
```ts
import { isValidPublicToken } from '../src/services/publicCheckout/publicCheckoutService';
isValidPublicToken('SP-AAAAA'); // false -- the old weak payment_code format must never be accepted here
isValidPublicToken('not-a-uuid'); // false
```

## Verification D: the old weak identifier (`payment_code`) cannot be used as a bearer token
```ts
await supabase.rpc('get_public_payment_request', { p_token: '<the request's payment_code, e.g. SP-AAAAA>' });
```
Expected: a Postgres error (invalid input syntax for type uuid) or, if coerced, zero rows — `payment_code` was never `public_token`'s value, and the function's parameter type is `uuid`, so a non-UUID string is rejected before any row lookup happens.

## Verification E: merchant-side links now embed the real token, not the old link
1. In the app, open **Request Created** for a freshly created request. Confirm the displayed link, QR code, Copy Link, Share, and WhatsApp message all use `https://.../p/<public_token>` (or your configured `EXPO_PUBLIC_CHECKOUT_BASE_URL`) — not `https://pay.speropay.app/r/<payment_code>`.
2. Open that same request's **Request Detail** screen and confirm "Payment Link" shows the same `/p/<public_token>` URL, and "Share Again" shares it.
3. Open **Invoice** for the request and confirm "Copy Payment Link" copies the `/p/<public_token>` URL.
4. Send a reminder (or copy the reminder message) from Request Detail and confirm the embedded link is the `/p/<public_token>` URL.

## Verification F: status transitions reach the public page
1. With the checkout page open (`/p/<public_token>`) in a browser tab, in another tab/session move the request through its states via the app's existing demo/mock flow (or by updating `payment_requests.status` directly via the SQL Editor, if the mock engine isn't convenient) — `pending → confirming → paid`.
2. Confirm the public page picks up each transition within one polling interval (~7s) without a manual refresh, and that polling stops once the page shows "Payment received" (no further network calls after that point — check the Network tab).
3. Separately, create a request with a `1m`-style short expiry (or manually set `expires_at` to a past timestamp via the SQL Editor) and confirm the public page shows the expired state and stops polling.

## What this does NOT test
- Actual on-chain USDC settlement — Phase 3A's `paymentVerifier`/`paymentMatcher` are unit-tested but not wired to any live confirmation flow yet (that's Phase 3C+).
- Cross-device access to a real deployed HTTPS URL — this project has not been deployed anywhere; all of the above is local/dev-server verification only.
