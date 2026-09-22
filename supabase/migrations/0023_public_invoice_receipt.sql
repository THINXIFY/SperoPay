-- Phase 3E: public invoice/receipt pages (/invoice/[token], /receipt/[token]).
-- Same anonymous-safe SECURITY DEFINER pattern as get_public_payment_request
-- (0005/0006/0009/0012) and get_customer_portal* (0014/0022): explicit
-- sanitized column list, never `select *`, never id/user_id/customer_id,
-- set search_path = '', granted to anon+authenticated, no RLS touched.
--
-- Reuses payment_requests.public_token -- no new token type. An invoice and
-- a receipt are just different sanitized views of the same request that
-- /p/<token> already resolves, not a new entity.
--
-- Deliberately does NOT expose business_profiles.business_email -- neither
-- get_public_payment_request nor get_customer_portal exposes it either;
-- following that existing precedent rather than introducing a new, more
-- permissive public field.

-- 0. Cleanup: orphaned artifacts from an abandoned, never-merged branch ------
-- An earlier attempt at this same feature was built on a stale branch that
-- didn't know about the real client portal (0014) and independently
-- invented its own customers.public_token column + get_public_invoice/
-- get_public_receipt/get_public_client_portal functions with a different,
-- simpler shape. That branch's migration was run directly against this
-- database before the duplication was caught (confirmed by this migration
-- initially failing with "cannot change return type of existing function"
-- on get_public_invoice). None of it is referenced anywhere in the real
-- codebase (confirmed by grep) -- it's pure orphaned cruft: a second,
-- unused anon-callable RPC and a redundant NOT NULL column silently
-- generating a real bearer token for every customer. Removed here rather
-- than left in place, since an unreferenced-but-live anon-granted function
-- and a live public token nobody rotates or revokes is a real surface to
-- clean up, not just cosmetic debt.
drop function if exists public.get_public_client_portal(uuid);
alter table public.customers drop column if exists public_token;

-- 1. Public invoice -----------------------------------------------------------
-- One row per request. Includes the same server-derived partial-payment
-- accounting (verified_paid_amount/remaining_amount, summed from real
-- transactions, never trusted from a client) as get_public_payment_request,
-- so an invoice can correctly show "Partially paid" / "Balance due" states.
--
-- drop-then-create, same reason every other RETURNS TABLE-shape change in
-- this codebase needs it (see 0006/0009/0012/0022's identical comments):
-- Postgres rejects CREATE OR REPLACE when the output column list differs
-- from what's already there. The live database already has a
-- get_public_invoice(uuid) with a different (older, abandoned-branch)
-- shape -- see section 0's cleanup comment above for why.
drop function if exists public.get_public_invoice(uuid);

create or replace function public.get_public_invoice(p_token uuid)
returns table (
  payment_code text,
  amount numeric,
  currency text,
  network text,
  description text,
  status text,
  created_at timestamptz,
  due_at timestamptz,
  expires_at timestamptz,
  merchant_name text,
  merchant_logo_url text,
  customer_name text,
  allow_partial_payments boolean,
  deposit_type text,
  deposit_value numeric,
  verified_paid_amount numeric,
  remaining_amount numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    pr.payment_code,
    pr.amount,
    pr.currency,
    pr.network,
    pr.description,
    pr.status,
    pr.created_at,
    pr.due_at,
    pr.expires_at,
    coalesce(nullif(bp.business_name, ''), nullif(p.display_name, '')) as merchant_name,
    bp.logo_url as merchant_logo_url,
    c.name as customer_name,
    pr.allow_partial_payments,
    pr.deposit_type,
    pr.deposit_value,
    coalesce(t.paid, 0) as verified_paid_amount,
    greatest(pr.amount - coalesce(t.paid, 0), 0) as remaining_amount
  from public.payment_requests pr
  join public.profiles p on p.id = pr.user_id
  left join public.business_profiles bp on bp.user_id = pr.user_id
  left join public.customers c on c.id = pr.customer_id
  left join lateral (
    select sum(amount) as paid from public.transactions where payment_request_id = pr.id
  ) t on true
  where pr.public_token = p_token;
end;
$$;

grant execute on function public.get_public_invoice(uuid) to anon;
grant execute on function public.get_public_invoice(uuid) to authenticated;

-- 2. Public receipt -------------------------------------------------------------
-- One row PER VERIFIED TRANSACTION, not per request -- transactions.
-- payment_request_id lost its unique constraint in 0012 specifically because
-- a partially-paid request can accumulate more than one real, independently
-- verified payment, and each is its own receipt line (same principle
-- get_customer_portal_payments, 0014, already established for the portal).
-- Zero rows means nothing has been verified-paid yet against this token --
-- the client composes this with get_public_invoice to tell "not paid yet"
-- apart from "invalid link" (see receiptService.ts), the same pattern the
-- merchant-authenticated Receipt screen already uses via request.status.
-- No merchant/customer identity columns here -- the client already has
-- those from the paired get_public_invoice call, so they're not duplicated.
--
-- drop-then-create defensively, same reasoning as get_public_invoice above.
drop function if exists public.get_public_receipt(uuid);

create or replace function public.get_public_receipt(p_token uuid)
returns table (
  amount numeric,
  currency text,
  paid_at timestamptz,
  tx_hash text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    t.amount,
    t.currency,
    t.paid_at,
    t.tx_hash
  from public.transactions t
  join public.payment_requests pr on pr.id = t.payment_request_id
  where pr.public_token = p_token
  order by t.paid_at asc;
end;
$$;

grant execute on function public.get_public_receipt(uuid) to anon;
grant execute on function public.get_public_receipt(uuid) to authenticated;
