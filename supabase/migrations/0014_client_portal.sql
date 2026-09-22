-- Phase 4D: Secure Client Portal. Purely additive -- no existing table's
-- RLS is loosened, no existing policy touched. The anonymous read surface
-- is entirely new, narrowly-scoped SECURITY DEFINER functions, the exact
-- same pattern get_public_payment_request already established in 0005: a
-- real gen_random_uuid() (122 bits, CSPRNG-backed at the Postgres level,
-- not a client-guessable or sequential value) as the only credential, an
-- explicit, hand-picked return column list (never `select *`), and no new
-- RLS policy granting anon anything on the underlying tables themselves.

-- 1. Portal token on customers -----------------------------------------
-- Nullable (unlike payment_requests.public_token, which is `not null
-- default gen_random_uuid()` because every request needs one immediately)
-- -- a portal link is created lazily, only when a merchant first opens
-- Client Portal controls for that customer, so existing customers need no
-- backfill and no forced migration step (spec: "Do not require all
-- existing customers to be recreated"). `unique` still applies -- Postgres
-- treats multiple NULLs as distinct, so any number of customers without a
-- portal token yet is fine.
alter table public.customers
  add column if not exists portal_token uuid unique,
  add column if not exists portal_token_created_at timestamptz;

create index if not exists idx_customers_portal_token
  on public.customers (portal_token)
  where portal_token is not null;

-- 2. Merchant-authenticated token management -----------------------------
-- Both SECURITY INVOKER (RLS applies) -- ordinary owner-scoped functions,
-- the same posture as every other customer-mutating operation in this
-- project. The customers_update_own RLS policy (0002) already restricts
-- the UPDATE below to the calling user's own row; the explicit
-- `and user_id = auth.uid()` here is defense in depth, not the only guard.

-- Idempotent: returns the existing token unchanged if one already exists,
-- only ever generating a new one the first time. Safe to call every time
-- the merchant opens Client Portal controls.
create or replace function public.ensure_customer_portal_token(p_customer_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token uuid;
begin
  select portal_token into v_token
  from public.customers
  where id = p_customer_id and user_id = auth.uid();

  if not found then
    raise exception 'customer not found';
  end if;

  if v_token is null then
    v_token := gen_random_uuid();
    update public.customers
    set portal_token = v_token, portal_token_created_at = now()
    where id = p_customer_id and user_id = auth.uid();
  end if;

  return v_token;
end;
$$;

-- Always issues a brand-new token, unconditionally replacing whatever was
-- there -- the old value stops matching any row in the same statement, so
-- it is immediately and permanently rejected by every get_customer_portal*
-- function below. No separate revocation list/table is needed: there is
-- exactly one live token per customer at any moment, by construction.
create or replace function public.regenerate_customer_portal_token(p_customer_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token uuid := gen_random_uuid();
  v_updated int;
begin
  update public.customers
  set portal_token = v_token, portal_token_created_at = now()
  where id = p_customer_id and user_id = auth.uid();

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'customer not found';
  end if;

  return v_token;
end;
$$;

grant execute on function public.ensure_customer_portal_token(uuid) to authenticated;
grant execute on function public.regenerate_customer_portal_token(uuid) to authenticated;

-- 3. Anonymous, sanitized portal reads ------------------------------------
-- Four narrow functions rather than one monolithic one, since a portal
-- genuinely needs several independent collections (merchant/customer
-- identity, requests, payments, recurring plans) that don't fit one flat
-- row shape -- but every one of them independently re-derives the owning
-- customer from p_token via its own `where c.portal_token = p_token`
-- lookup. None of them ever trusts a customer_id, request id, or any
-- other identifier the client might supply -- there is no such parameter
-- anywhere in this section. A request's own already-public
-- payment_requests.public_token (proven safe since Phase 3B) is what a
-- portal uses to deep-link into the existing, completely unmodified
-- checkout at /p/<public_token> -- this is what makes "reuse the existing
-- checkout, do not build another payment implementation" true by
-- construction, not just by convention. payment_requests.id,
-- customers.id, and every other internal id are never selected by any
-- function below.

-- 3a. Merchant + customer identity (one row) -- the greeting header.
create or replace function public.get_customer_portal(p_token uuid)
returns table (
  merchant_name text,
  merchant_logo_url text,
  customer_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    coalesce(nullif(bp.business_name, ''), nullif(p.display_name, '')) as merchant_name,
    bp.logo_url as merchant_logo_url,
    c.name as customer_name
  from public.customers c
  join public.profiles p on p.id = c.user_id
  left join public.business_profiles bp on bp.user_id = c.user_id
  where c.portal_token = p_token;
end;
$$;

-- 3b. This customer's requests with this merchant, with server-derived
-- accounting (verified_paid_amount/remaining_amount summed from real
-- transactions, exactly like get_public_payment_request's own accounting
-- in 0012 -- never trusted from a client, never cached). request_public_
-- token is the request's OWN pre-existing public token (0005) -- what
-- "Pay now"/"Continue payment" deep-links to. due_at/expires_at/status let
-- the client derive customer-friendly labels (Due soon/Overdue/etc.)
-- without a technical status ever reaching the portal UI as anything but
-- raw data to translate.
create or replace function public.get_customer_portal_requests(p_token uuid)
returns table (
  request_public_token uuid,
  description text,
  amount numeric,
  currency text,
  network text,
  status text,
  due_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
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
declare
  v_customer_id uuid;
  v_user_id uuid;
begin
  select c.id, c.user_id into v_customer_id, v_user_id
  from public.customers c
  where c.portal_token = p_token;

  if not found then
    return;
  end if;

  return query
  select
    pr.public_token as request_public_token,
    pr.description,
    pr.amount,
    pr.currency,
    pr.network,
    pr.status,
    pr.due_at,
    pr.expires_at,
    pr.created_at,
    pr.allow_partial_payments,
    pr.deposit_type,
    pr.deposit_value,
    coalesce(t.paid, 0) as verified_paid_amount,
    greatest(pr.amount - coalesce(t.paid, 0), 0) as remaining_amount
  from public.payment_requests pr
  left join lateral (
    select sum(amount) as paid from public.transactions where payment_request_id = pr.id
  ) t on true
  where pr.customer_id = v_customer_id and pr.user_id = v_user_id
  order by pr.created_at desc;
end;
$$;

-- 3c. Verified payments only (Payment History + per-request receipts,
-- grouped client-side by request_public_token) -- capped at the 50 most
-- recent so a very long-lived customer relationship never forces the
-- portal's first load to pull an unbounded history (spec's performance
-- section). tx_hash is included since it's already public on-chain data,
-- not an internal identifier -- safe to show as a receipt's own reference.
create or replace function public.get_customer_portal_payments(p_token uuid)
returns table (
  request_public_token uuid,
  request_description text,
  amount numeric,
  currency text,
  tx_hash text,
  paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_user_id uuid;
begin
  select c.id, c.user_id into v_customer_id, v_user_id
  from public.customers c
  where c.portal_token = p_token;

  if not found then
    return;
  end if;

  return query
  select
    pr.public_token as request_public_token,
    pr.description as request_description,
    t.amount,
    t.currency,
    t.tx_hash,
    t.paid_at
  from public.transactions t
  join public.payment_requests pr on pr.id = t.payment_request_id
  where pr.customer_id = v_customer_id and pr.user_id = v_user_id
  order by t.paid_at desc
  limit 50;
end;
$$;

-- 3d. Recurring plans this customer is on -- informational only, by
-- construction: no id, no controls, nothing a customer could use to
-- pause/edit/end anything even if they tried. Only currently-active plans
-- (a merchant-paused or ended plan is not the customer's concern).
create or replace function public.get_customer_portal_recurring(p_token uuid)
returns table (
  description text,
  amount numeric,
  currency text,
  frequency text,
  custom_interval_days integer,
  next_run_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_user_id uuid;
begin
  select c.id, c.user_id into v_customer_id, v_user_id
  from public.customers c
  where c.portal_token = p_token;

  if not found then
    return;
  end if;

  return query
  select rp.description, rp.amount, rp.currency, rp.frequency, rp.custom_interval_days, rp.next_run_at
  from public.recurring_payment_plans rp
  where rp.customer_id = v_customer_id and rp.user_id = v_user_id and rp.active = true
  order by rp.next_run_at asc;
end;
$$;

grant execute on function public.get_customer_portal(uuid) to anon;
grant execute on function public.get_customer_portal(uuid) to authenticated;
grant execute on function public.get_customer_portal_requests(uuid) to anon;
grant execute on function public.get_customer_portal_requests(uuid) to authenticated;
grant execute on function public.get_customer_portal_payments(uuid) to anon;
grant execute on function public.get_customer_portal_payments(uuid) to authenticated;
grant execute on function public.get_customer_portal_recurring(uuid) to anon;
grant execute on function public.get_customer_portal_recurring(uuid) to authenticated;
