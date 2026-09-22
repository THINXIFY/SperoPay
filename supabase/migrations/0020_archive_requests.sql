-- Archive Requests: lets a merchant move an old request out of their main
-- list without deleting anything -- payment history, invoice/receipt data,
-- and transactions all stay exactly as they are; only visibility changes.
--
-- `archived_at timestamptz null` (nullable timestamp, not a plain boolean)
-- so archiving is real history -- WHEN a request was archived is preserved,
-- not just THAT it was, at negligible extra cost over a boolean. Every
-- existing request has archived_at = null by definition of adding a new
-- nullable column with no default -- no backfill needed, every request
-- that exists today remains unarchived exactly as it was.
--
-- No RLS policy change needed: payment_requests already has a single,
-- unrestricted "own rows" update policy (payment_requests_update_own,
-- 0002_phase2b_rls.sql) covering every column, the same policy
-- deleteRequest already relies on for a plain client-side
-- `.update()`/`.delete()` -- archiving needs no new RPC or grant.
alter table public.payment_requests
  add column if not exists archived_at timestamptz null;

-- Every list screen either excludes archived rows (the default view) or
-- shows only them (the Archived filter) -- both are a straight (user_id,
-- archived_at) lookup, worth a real index once a merchant has a large
-- history.
create index if not exists idx_payment_requests_user_archived
  on public.payment_requests (user_id, archived_at);
