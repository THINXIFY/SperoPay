# Phase 3D — Deployment & Manual Verification

Phase 3D adds the project's first Supabase Edge Function (`verify-payment`). Nothing in this phase works until it's actually deployed — the client calls it, but there is no fallback if it's missing (the checkout page just stays on whatever status the database already has, which is the safe failure mode, not an error).

## Prerequisites (one-time)

1. Install the Supabase CLI if you don't already have it: https://supabase.com/docs/guides/cli/getting-started
2. From the project root, link the CLI to your Supabase project (you'll need your project ref, found in the Supabase Dashboard's project settings — Project ID):
   ```
   supabase link --project-ref <your-project-ref>
   ```
   This will prompt for your database password.

## Step 1: Apply migrations 0006 and 0007

If `0006_phase3c_solana_pay.sql` isn't applied yet, apply it first (Supabase Dashboard → SQL Editor → paste → Run), then `0007_phase3d_payment_verification.sql` the same way.

To confirm both landed correctly:
```sql
select proname, pronargs from pg_proc where proname in ('mark_payment_detected', 'complete_verified_payment');
```
Expected: two rows (`mark_payment_detected` with 1 arg, `complete_verified_payment` with 2 args).

## Step 2: Set the Edge Function's server-side secrets

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into every Edge Function by Supabase — you do not set these yourself. You only need to set the Solana-specific ones, and **only if you want anything other than the safe default (public devnet)**:

```
supabase secrets set SOLANA_NETWORK=devnet
```

Leave `SOLANA_RPC_URL` unset to use Solana's free public devnet endpoint. If you have a paid RPC provider, set it too:
```
supabase secrets set SOLANA_RPC_URL=https://your-provider-url
```

**Do not set `SOLANA_NETWORK=mainnet-beta` until you're intentionally ready for real money.** This is a separate, server-only setting from the app's `EXPO_PUBLIC_SOLANA_NETWORK` — the two must be kept in sync manually (see "Important operational note" below).

## Step 3: Deploy the function

```
supabase functions deploy verify-payment
```

Confirm it deployed by checking the Supabase Dashboard → Edge Functions — `verify-payment` should be listed and "Active".

## Important operational note: two separate network settings

This project now has **two** independent `SolanaEnvironment` settings that must be changed together, or verification will always fail (safely — as `wrong_mint`, never as a false "paid"):

- `EXPO_PUBLIC_SOLANA_NETWORK` — read by the mobile/web app, controls what network the Solana Pay URI (`app/p/[token].tsx`'s "Pay with Wallet") tells the payer's wallet to use.
- `SOLANA_NETWORK` — read only by the `verify-payment` Edge Function, controls what network it checks Solana against.

Both default to `devnet` if unset, so a fresh setup is consistent by default. If you ever move to `mainnet-beta`, you must set **both**.

## If Verification A returns 401 instead of the expected response

Supabase's default per-project setting requires every Edge Function call to carry a valid JWT — the anon key itself satisfies this, and `supabase.functions.invoke()` attaches it automatically, so this normally isn't an issue. If you still see a 401, redeploy with JWT verification explicitly disabled for this one function (it doesn't need a session either way — it only ever accepts a `public_token`, the same anonymous-safe credential the rest of public checkout already uses):
```
supabase functions deploy verify-payment --no-verify-jwt
```

## Verification A: the function is reachable and rejects malformed input
```ts
const { data, error } = await supabase.functions.invoke('verify-payment', { body: { public_token: 'not-a-uuid' } });
```
Expected: a 400-style response body `{ ok: false, error: 'invalid_request' }`. Confirms the function is deployed and its input validation runs before touching the database at all.

## Verification B: a request that isn't payable returns its status without touching Solana
Pick any `paid`/`cancelled` request's `public_token` (or a request you haven't created yet — an unknown token):
```ts
await supabase.functions.invoke('verify-payment', { body: { public_token: '<token>' } });
```
Expected: `{ ok: true, status: 'paid' }` (or `'cancelled'`, or `'not_found'` for an unknown token) — no Solana RPC calls happen for these, confirmed by the Edge Function's logs (Dashboard → Edge Functions → verify-payment → Logs) showing no Solana-related log lines for this invocation.

## Verification C: anonymous callers cannot reach the two completion RPCs directly
Using the anon key only:
```ts
await supabase.rpc('complete_verified_payment', { p_request_id: '<any request id>', p_tx_hash: 'fake' });
await supabase.rpc('mark_payment_detected', { p_request_id: '<any request id>' });
```
Expected: both fail with a permission-denied-style Postgres error (`42501` or similar) — these functions have no grant to `anon`/`authenticated`, confirming the only path to them is the Edge Function's service-role client.

## Manual end-to-end devnet test

1. Create a payment request in the app as normal, then open its `/p/<public_token>` public checkout page.
2. Tap "Pay with Wallet" using a devnet-configured Solana Pay-compatible wallet (e.g. Phantom set to devnet), and complete the transfer with real devnet USDC (use a devnet USDC faucet if you don't have any).
3. Within one polling interval (~7s), confirm the checkout page moves to **"Payment detected / Confirming on Solana…"**, then to **"Payment received"** once the transaction reaches `confirmed`.
4. In the SQL Editor, confirm:
   ```sql
   select status from public.payment_requests where public_token = '<token>';
   select tx_hash, amount from public.transactions where payment_request_id = (select id from public.payment_requests where public_token = '<token>');
   select event_type from public.request_events where payment_request_id = (select id from public.payment_requests where public_token = '<token>') order by occurred_at;
   ```
   Expected: `status = 'paid'`, exactly one `transactions` row with the real transaction signature, and exactly one `payment_detected` and one `payment_confirmed` event (not duplicated, even though verification ran on every poll while the transaction was settling).
5. Open the request's **Request Detail** and **Receipt** screens in the merchant app and confirm they now reflect the real transaction (this exercises existing, unmodified screens — Phase 3D intentionally didn't touch them).

## What this phase's automated tests do NOT cover

- The Edge Function's own Deno/HTTP/Supabase-client plumbing (`supabase/functions/verify-payment/index.ts`) — Deno is not available in the environment this was built in, so this file has been carefully written and reviewed but **not type-checked or executed in a real Deno runtime**. Every actual verification rule it relies on (`findPaymentForRequest`, `matchPayment`, `verifyPayment`, `parsePaymentTransaction`) is unit-tested in the main Jest suite, since those are the same files imported unchanged into the function. Run the manual devnet test above before trusting this in front of a real payer.
- Real Solana devnet network behavior (RPC latency, actual confirmation timing) — only reachable via the manual test above.
