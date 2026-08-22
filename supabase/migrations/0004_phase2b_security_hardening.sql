-- Phase 2B cleanup: defense-in-depth for request_events/transactions.
--
-- request_events_insert_own/transactions_insert_own (0002) only checked
-- `auth.uid() = user_id` on the row being written — that's enough to stop a
-- caller from mislabeling a row as someone else's, but it does NOT stop a
-- caller from labeling a row as their own (a real user_id they legitimately
-- own) while pointing payment_request_id at a DIFFERENT user's payment
-- request. No current code path does this (every write goes through an RPC
-- or a lookup already scoped to the caller's own requestStore state — see
-- request_events_insert_own's original audit), but that's application
-- discipline, not a database guarantee. This migration adds an explicit
-- ownership check on the referenced payment_requests row, on INSERT and
-- UPDATE (SELECT/DELETE already only ever expose the caller's own rows via
-- the unchanged `auth.uid() = user_id` policies, and neither event nor
-- transaction rows are ever deleted independently of their parent request's
-- cascade).
--
-- No recursion risk: payment_requests' own RLS policies only reference
-- payment_requests.user_id directly, never request_events/transactions, so
-- this EXISTS subquery can't cycle back into itself.
--
-- Column references in the EXISTS subqueries are explicitly table-qualified
-- (request_events.payment_request_id / transactions.payment_request_id)
-- rather than left bare — bare references still resolve correctly today,
-- but only because payment_requests happens not to have a column of that
-- name; qualifying removes that implicit dependency.
--
-- Every policy is dropped before being (re)created so this migration can be
-- pasted more than once without erroring on "policy already exists".

drop policy if exists "request_events_insert_own" on public.request_events;
create policy "request_events_insert_own" on public.request_events
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.payment_requests pr
      where pr.id = request_events.payment_request_id and pr.user_id = auth.uid()
    )
  );

drop policy if exists "request_events_update_own" on public.request_events;
create policy "request_events_update_own" on public.request_events
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.payment_requests pr
      where pr.id = request_events.payment_request_id and pr.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.payment_requests pr
      where pr.id = request_events.payment_request_id and pr.user_id = auth.uid()
    )
  );

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.payment_requests pr
      where pr.id = transactions.payment_request_id and pr.user_id = auth.uid()
    )
  );

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.payment_requests pr
      where pr.id = transactions.payment_request_id and pr.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.payment_requests pr
      where pr.id = transactions.payment_request_id and pr.user_id = auth.uid()
    )
  );
