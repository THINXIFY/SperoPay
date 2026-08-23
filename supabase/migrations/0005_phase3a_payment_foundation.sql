-- Phase 3A: database foundation for real Solana/USDC payment verification.
-- Adds exactly what this phase's architecture needs, nothing speculative:
-- an opaque public checkout token, a duplicate-signature guard, USDC-grade
-- amount precision, and the project's first anonymous-access RPC. Nothing
-- here is called by the app yet (see the phase's design doc) -- the mobile
-- app is not wired to any of this in Phase 3A.

-- 1. Opaque public checkout token -------------------------------------------
-- payment_code (SP-XXXXX) is ~25 bits of Math.random() entropy -- nowhere
-- near enough to gate a public payment page (a scripted enumeration of the
-- ~39M possible codes is trivial). public_token is a real gen_random_uuid()
-- (122 bits, CSPRNG-backed at the Postgres level) -- this is what a real
-- payment link will encode once one exists (Phase 3B), never payment_code
-- or the internal id.
alter table public.payment_requests
  add column if not exists public_token uuid unique not null default gen_random_uuid();

-- 2. Duplicate-signature protection at the database level -------------------
-- Server logic (complete_payment's `status = 'confirming'` guard) already
-- prevents crediting a request twice; this adds an independent, unrelated
-- guarantee that the same on-chain signature can never be recorded against
-- more than one transaction row, regardless of application logic.
alter table public.transactions drop constraint if exists transactions_tx_hash_key;
alter table public.transactions add constraint transactions_tx_hash_key unique (tx_hash);

-- 3. USDC-grade amount precision ---------------------------------------------
-- numeric(18,2) is correct for a 2-decimal display value but lossy for
-- real on-chain USDC amounts (6 decimals). Widening is safe and
-- non-breaking -- existing 2-decimal values are unaffected, this just
-- stops future finer-grained amounts from being silently truncated.
-- (On-chain comparisons themselves happen in bigint base units via
-- src/services/blockchain/solana/amount.ts, never as numeric/float
-- arithmetic -- this column widening is about not losing precision in
-- what gets *stored*, not how verification math is done.)
alter table public.payment_requests alter column amount type numeric(20, 6);
alter table public.transactions alter column amount type numeric(20, 6);

-- 4. Public checkout lookup ---------------------------------------------------
-- The project's first SECURITY DEFINER function -- deliberately, since this
-- is the first-ever anonymous/cross-user access path (every other function
-- in this project is SECURITY INVOKER because every prior caller was always
-- the row's own owner). Scoped as tightly as this project's other functions:
-- set search_path = '' (every reference below is schema-qualified), and the
-- return shape is an explicit, narrow column list -- never `select *`, and
-- never the row's id, user_id, or customer_id. No new RLS policy is added
-- anywhere and no existing policy is loosened; SECURITY DEFINER steps around
-- RLS only inside this one function's return shape, which is the standard,
-- correct Postgres pattern for exposing a computed, sanitized view of
-- otherwise-private data -- the alternative (a public RLS policy on
-- payment_requests) would expose the whole row shape to any anonymous
-- query, which this project's security rules explicitly forbid.
--
-- The wallet is joined by `w.user_id = pr.user_id` rather than
-- `w.id = pr.wallet_id`: today the app always creates requests with
-- wallet_id = null (create_payment_request's per-request wallet selection
-- isn't wired up to any UI yet), so joining on the request's own wallet_id
-- would return no destination address for any request that exists today.
-- Since this project is currently single-wallet-per-user (wallets.user_id
-- is unique), joining on the owner directly returns the merchant's actual
-- configured receiving address, matching real current behavior.
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
  destination_wallet text
)
language plpgsql
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
    w.address as destination_wallet
  from public.payment_requests pr
  join public.profiles p on p.id = pr.user_id
  left join public.business_profiles bp on bp.user_id = pr.user_id
  left join public.wallets w on w.user_id = pr.user_id
  where pr.public_token = p_token;
end;
$$;

grant execute on function public.get_public_payment_request(uuid) to anon;
grant execute on function public.get_public_payment_request(uuid) to authenticated;
