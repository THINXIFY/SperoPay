# Phase 2B — Manual RLS Verification

Run once the three migrations (0001, 0002, 0003) have been applied via the Supabase Dashboard's SQL Editor, in that order.

## Setup
1. Create two real accounts through the app (sign up twice with different emails) — call them **User A** and **User B**.
2. As User A: add one customer, set a wallet address, create one payment request, and run it through the demo payment flow to completion (so a transaction row exists too).

## Verification A: each user sees only their own data (app-level)
1. Sign out, sign in as **User B**.
2. Confirm: Customers list is empty, Requests list is empty, Wallet Settings shows no address, Templates list is empty (or only whatever User B has created).
3. Confirm none of User A's data (customer name, request amount/description, wallet address) appears anywhere.

## Verification B: RLS itself, not just the app UI (Supabase SQL Editor)
Run as the `postgres`/service role in the SQL Editor (this bypasses RLS by design — it's how you inspect ground truth):

```sql
select id, user_id, name from public.customers order by created_at desc limit 5;
select id, user_id, address from public.wallets order by created_at desc limit 5;
select id, user_id, payment_code, amount from public.payment_requests order by created_at desc limit 5;
select id, user_id, tx_hash from public.transactions order by created_at desc limit 5;
```
Confirm every row's `user_id` matches the account that actually created it — this is ground truth for what RLS *should* be enforcing.

Then, in the **Authentication → Users** section, copy User A's UID. In the SQL Editor, simulate being User B by using the `authenticator` role with an RLS-respecting query (the Dashboard's SQL Editor runs as a superuser and bypasses RLS by default, so this step specifically needs to go through the app or `supabase-js` with User B's real session — not the SQL Editor — to be a true RLS test):

1. In the app, while signed in as **User B**, open browser/Metro dev tools network inspection (or just trust the UI check in Verification A, which already reflects real RLS-filtered responses since the app only ever uses the anon key + the signed-in user's JWT, never a service role).
2. As a stronger check: in the SQL Editor, run `set role authenticated; set request.jwt.claims = '{"sub":"<User B's UID>"}'; select * from public.customers;` (then `reset role;` after) — this should return zero rows for User A's customers even though they exist in the table, proving the policy — not just client-side filtering — is what's blocking access.

## Verification C: cannot write to another user's rows
While signed in as User B (via the app, or `supabase-js` with User B's session), attempt:
```ts
await supabase.from('customers').update({ name: 'Hacked' }).eq('id', '<User A\'s customer id>');
```
Expected: the update affects 0 rows (RLS `USING` clause silently filters it out — no error, just no match), and User A's customer name is unchanged when checked via the SQL Editor.

Repeat for `wallets`, `payment_requests`, `transactions` with an UPDATE and a DELETE attempt each, confirming 0 rows affected every time.

## Verification D: the RPC functions also respect ownership
While signed in as User B, attempt to call the four Postgres functions against one of User A's requests:
```ts
await supabase.rpc('begin_payment_confirmation', { p_request_id: '<User A\'s request id>' });
await supabase.rpc('complete_payment', { p_request_id: '<User A\'s request id>', p_should_fail: false, p_tx_hash: 'x' });
await supabase.rpc('cancel_payment_request', { p_request_id: '<User A\'s request id>' });
```
Expected: each returns `false`/`null` (the `where ... and user_id = auth.uid()` clause inside each function matches zero rows) — User A's request status is unchanged when checked via the SQL Editor.
