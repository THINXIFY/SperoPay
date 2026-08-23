-- Phase 3C: Solana Pay payment initiation. Adds a per-request public
-- reference so a future phase can identify the on-chain transaction that
-- pays a given request, and plumbs it through the two existing RPCs that
-- create/expose payment requests. Does not touch payment verification —
-- see design doc for why the reference alone proves nothing yet.

-- 1. Public Solana Pay reference -------------------------------------------
-- Generated client-side (src/services/blockchain/solana/reference.ts) via
-- Keypair.generate().publicKey.toBase58() -- a real, on-curve Solana public
-- key with no corresponding secret key ever read or stored. Nullable: no
-- backfill for rows created before this migration (they predate the
-- Solana Pay flow and were never going to be paid through it). Unique so
-- two requests can never collide on the same on-chain lookup key.
alter table public.payment_requests
  add column if not exists solana_reference text unique;

create index if not exists idx_payment_requests_solana_reference
  on public.payment_requests(solana_reference);

-- 2. create_payment_request: accept the reference from the client -----------
-- Adding a parameter changes the function's signature (Postgres identifies
-- functions by name + argument types), so CREATE OR REPLACE alone would
-- leave the old 9-argument version behind as a separate, stale overload.
-- Drop the exact old signature first, then create the 10-argument version.
drop function if exists public.create_payment_request(
  uuid, uuid, text, numeric, text, text, text, timestamptz, text
);

create or replace function public.create_payment_request(
  p_customer_id uuid,
  p_wallet_id uuid,
  p_payment_code text,
  p_amount numeric,
  p_description text,
  p_note text,
  p_expiry_option text,
  p_expires_at timestamptz,
  p_payment_link text,
  p_solana_reference text default null
) returns public.payment_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.payment_requests;
begin
  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and user_id = auth.uid()
  ) then
    raise exception 'customer not found';
  end if;
  if p_wallet_id is not null and not exists (
    select 1 from public.wallets where id = p_wallet_id and user_id = auth.uid()
  ) then
    raise exception 'wallet not found';
  end if;

  insert into public.payment_requests (
    user_id, customer_id, wallet_id, payment_code, amount, description, note,
    expiry_option, expires_at, payment_link, solana_reference
  ) values (
    auth.uid(), p_customer_id, p_wallet_id, p_payment_code, p_amount, p_description, p_note,
    p_expiry_option, p_expires_at, p_payment_link, p_solana_reference
  )
  returning * into v_request;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (auth.uid(), v_request.id, 'created');

  return v_request;
end;
$$;

grant execute on function public.create_payment_request(
  uuid, uuid, text, numeric, text, text, text, timestamptz, text, text
) to authenticated;

-- 3. get_public_payment_request: return the reference too -------------------
-- Changing the RETURNS TABLE shape also requires drop-then-create (Postgres
-- rejects CREATE OR REPLACE if the output column list differs).
drop function if exists public.get_public_payment_request(uuid);

create or replace function public.get_public_payment_request(p_token uuid)
returns table (
  payment_code text,
  amount numeric,
  currency text,
  network text,
  description text,
  status text,
  expires_at timestamptz,
  merchant_name text,
  destination_wallet text,
  solana_reference text
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
    pr.expires_at,
    coalesce(nullif(bp.business_name, ''), nullif(p.display_name, '')) as merchant_name,
    w.address as destination_wallet,
    pr.solana_reference
  from public.payment_requests pr
  join public.profiles p on p.id = pr.user_id
  left join public.business_profiles bp on bp.user_id = pr.user_id
  left join public.wallets w on w.user_id = pr.user_id
  where pr.public_token = p_token;
end;
$$;

grant execute on function public.get_public_payment_request(uuid) to anon;
grant execute on function public.get_public_payment_request(uuid) to authenticated;
