# Phase 3C — Solana Pay Manual Verification

Run once migration `0006_phase3c_solana_pay.sql` has been applied. This migration replaces two existing functions (`create_payment_request`, `get_public_payment_request`) by dropping their old exact signature first, so it's worth confirming the replacement actually took (no stale duplicate overload, no broken caller).

## Setup
Apply `0006_phase3c_solana_pay.sql` via the Supabase Dashboard's SQL Editor (after `0001`–`0005` are already applied).

## Verification A: the old 9-argument `create_payment_request` no longer exists
```sql
select proname, pronargs from pg_proc where proname = 'create_payment_request';
```
Expected: exactly **one** row, with `pronargs = 10`. If two rows appear (one with `pronargs = 9`), the old overload wasn't dropped correctly and the app's 10-argument call could silently resolve to the wrong function in some ambiguous scenario — re-run the `drop function` statement from the migration manually.

## Verification B: creating a request produces a valid, unique reference
1. In the app, sign in and create a new payment request as normal (no UI change expected — section 4 of the spec).
2. In the SQL Editor:
   ```sql
   select id, payment_code, public_token, solana_reference from public.payment_requests order by created_at desc limit 1;
   ```
3. Confirm `solana_reference` is populated (not null) and looks like a base58 Solana address (32-44 chars, no `0`, `O`, `I`, `l`).
4. Create a second request and confirm its `solana_reference` differs from the first.

## Verification C: `get_public_payment_request` returns the reference to anonymous callers
Using the anon key only (no session), with the `public_token` from Verification B:
```ts
const { data } = await supabase.rpc('get_public_payment_request', { p_token: '<public_token>' });
```
Expected: the returned row includes `solana_reference` matching what Verification B showed, alongside the existing 9 fields from Phase 3B. Confirm it still does **not** include `id`, `user_id`, or `customer_id`.

## Verification D: old pre-migration requests degrade safely
For any request created before this migration (`solana_reference is null`):
1. Open its `/p/<public_token>` public checkout page.
2. Confirm the page does not crash and does not show a "Pay with Wallet" button, QR code, or manual payment details section — `buildSolanaPayUrl` is never called with a null reference; the checkout page simply omits the payment section (general request details still show as before).

## Verification E: end-to-end Solana Pay URI (manual, devnet)
1. Open a pending request's `/p/<public_token>` page. Confirm a **Devnet** badge is visible (unless `EXPO_PUBLIC_SOLANA_NETWORK=mainnet-beta` is explicitly set).
2. Tap "Pay with Wallet" on a device with a Solana Pay-compatible wallet installed (e.g. Phantom) set to devnet. Confirm the wallet opens with the merchant's receiving address, "500.00"-style amount, and devnet USDC already filled in — the payer should not need to choose or type anything.
3. Without approving, return to Spero. Confirm the page shows "Checking for your payment…" (updated in Phase 3E from the original "Waiting for payment confirmation…") and never flips to "Payment received" on its own.
4. On a device with no compatible wallet installed, tap "Pay with Wallet" and confirm the friendly "No compatible Solana wallet found." message appears, and the QR code / manual payment details remain usable as a fallback.

## What this does NOT test
- Real payment verification — nothing in this phase marks a request paid from an on-chain transaction. That's Phase 3D.
- Whether a specific third-party wallet actually implements the Solana Pay `solana:` URI scheme correctly — that's the wallet's responsibility, not something this app controls.
