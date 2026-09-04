-- Exposes the merchant's business logo (if set) on the public checkout RPC,
-- so a payer sees who they're actually paying, not just a name -- the same
-- trust-level field as merchant_name, already exposed by this same
-- function. business_profiles.logo_url itself is not new (0001), and this
-- function already joins business_profiles (0006) -- this migration only
-- adds one more column to what it already selects and returns.
--
-- Changing RETURNS TABLE's shape requires drop-then-create (Postgres
-- rejects CREATE OR REPLACE if the output column list differs) -- same
-- reason 0006 itself had to do this when it added solana_reference.
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
  merchant_logo_url text,
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
    bp.logo_url as merchant_logo_url,
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
