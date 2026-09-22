-- Phase 7: USDC + EURC Multi-Currency Upgrade.
--
-- payment_requests.currency / transactions.currency / payment_templates.currency
-- / recurring_payment_plans.currency already exist as unconstrained `text`
-- columns defaulting to 'USDC' (0001, 0010, 0012) -- every existing row is
-- therefore already correctly "USDC" and needs no data backfill/UPDATE at
-- all. This migration:
--   1. Locks each of those four columns down to exactly the app's
--      allowlisted asset registry (src/config/assets.ts) via a CHECK
--      constraint -- the DB-level backstop behind the app-level
--      isSupportedAsset()/isKnownAssetMint() gates, so an arbitrary
--      currency value can never be written even if some future client
--      bug bypassed the app's own validation. Same treatment for
--      `network`, which this phase keeps Solana-only.
--   2. Adds `p_currency` to create_payment_request so a merchant can
--      actually create a EURC request (previously the RPC had no such
--      parameter and always fell through to the column default).
--   3. Fixes complete_verified_payment's and generate_recurring_request's
--      notification message text, which hardcoded the literal " USDC "
--      regardless of the request/plan's real currency.
-- No RLS policy is touched -- every table's existing row-level
-- "own rows only" policies (0002/0012/0014) already cover every column on
-- the row, currency included.

-- 1. Allowlist constraints -----------------------------------------------
-- Every existing row is 'USDC'/'Solana' (the only values ever written
-- before this migration), so these constraints are satisfiable by 100% of
-- current data with no backfill required.
alter table public.payment_requests
  add constraint payment_requests_currency_allowlist check (currency in ('USDC', 'EURC')),
  add constraint payment_requests_network_allowlist check (network in ('Solana'));

alter table public.transactions
  add constraint transactions_currency_allowlist check (currency in ('USDC', 'EURC')),
  add constraint transactions_network_allowlist check (network in ('Solana'));

alter table public.payment_templates
  add constraint payment_templates_currency_allowlist check (currency in ('USDC', 'EURC'));

alter table public.recurring_payment_plans
  add constraint recurring_payment_plans_currency_allowlist check (currency in ('USDC', 'EURC')),
  add constraint recurring_payment_plans_network_allowlist check (network in ('Solana'));

-- Cheap filter for a future "Reports: which currencies does this merchant
-- actually use" query (Phase 7's Reports/Analytics per-currency
-- separation) -- avoids a full sequential scan once a merchant has a real
-- transaction history in both assets.
create index if not exists idx_transactions_user_currency on public.transactions (user_id, currency);
create index if not exists idx_payment_requests_user_currency on public.payment_requests (user_id, currency);

-- 2. create_payment_request: accept the merchant's chosen currency --------
-- Adding a parameter changes the function's identity in Postgres, so the
-- exact prior (0012) signature must be dropped first -- same pattern 0012
-- itself used over 0011's signature.
drop function if exists public.create_payment_request(
  uuid, uuid, text, numeric, text, text, text, timestamptz, text, text, timestamptz, boolean, text, numeric
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
  p_solana_reference text default null,
  p_due_at timestamptz default null,
  p_allow_partial_payments boolean default false,
  p_deposit_type text default null,
  p_deposit_value numeric default null,
  p_currency text default 'USDC'
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
  -- Defense in depth ahead of the table's own CHECK constraint above --
  -- fails with a clear, specific error rather than a generic constraint-
  -- violation message, matching this function's existing style for other
  -- invalid input.
  if p_currency not in ('USDC', 'EURC') then
    raise exception 'unsupported currency: %', p_currency;
  end if;

  insert into public.payment_requests (
    user_id, customer_id, wallet_id, payment_code, amount, description, note,
    expiry_option, expires_at, payment_link, solana_reference, due_at,
    allow_partial_payments, deposit_type, deposit_value, currency
  ) values (
    auth.uid(), p_customer_id, p_wallet_id, p_payment_code, p_amount, p_description, p_note,
    p_expiry_option, p_expires_at, p_payment_link, p_solana_reference, p_due_at,
    p_allow_partial_payments, p_deposit_type, p_deposit_value, p_currency
  )
  returning * into v_request;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (auth.uid(), v_request.id, 'created');

  return v_request;
end;
$$;

grant execute on function public.create_payment_request(
  uuid, uuid, text, numeric, text, text, text, timestamptz, text, text, timestamptz, boolean, text, numeric, text
) to authenticated;

-- 3. Notification text: use the request/plan's REAL currency ---------------
-- Same signatures as 0018 -- CREATE OR REPLACE preserves the existing ACLs
-- (revoke-all-from-public/anon, execute granted only where 0012/0018
-- already granted it) automatically. Every line above the notification
-- inserts is byte-for-byte unchanged from 0018.
create or replace function public.complete_verified_payment(
  p_request_id uuid,
  p_tx_hash text,
  p_amount numeric default null
) returns setof public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.payment_requests;
  v_transaction public.transactions;
  v_credit_amount numeric;
  v_total_paid numeric;
  v_amount_text text;
begin
  select * into v_request
  from public.payment_requests
  where id = p_request_id
    and status in ('pending', 'confirming')
    and (expires_at is null or expires_at > now())
  for update;

  if not found then
    return;
  end if;

  if exists (select 1 from public.transactions where tx_hash = p_tx_hash) then
    return;
  end if;

  v_credit_amount := coalesce(p_amount, v_request.amount);

  insert into public.transactions (user_id, payment_request_id, from_customer_id, amount, currency, network, tx_hash)
  values (v_request.user_id, p_request_id, v_request.customer_id, v_credit_amount, v_request.currency, v_request.network, p_tx_hash)
  returning * into v_transaction;

  select coalesce(sum(amount), 0) into v_total_paid
  from public.transactions
  where payment_request_id = p_request_id;

  update public.payment_requests
  set status = case when v_total_paid >= v_request.amount then 'paid' else 'pending' end
  where id = p_request_id;

  v_amount_text := trim(trailing '.' from trim(trailing '0' from v_credit_amount::text));

  if v_total_paid >= v_request.amount then
    insert into public.request_events (user_id, payment_request_id, event_type)
    values (v_request.user_id, p_request_id, 'payment_confirmed');

    insert into public.notifications (user_id, type, title, message, entity_type, entity_id)
    values (
      v_request.user_id,
      'payment_received',
      'Payment received',
      v_amount_text || ' ' || v_request.currency || ' received for ' || v_request.payment_code || '.',
      'request',
      p_request_id
    );
  else
    insert into public.notifications (user_id, type, title, message, entity_type, entity_id)
    values (
      v_request.user_id,
      'payment_partial',
      'Partial payment received',
      v_amount_text || ' ' || v_request.currency || ' received for ' || v_request.payment_code || '.',
      'request',
      p_request_id
    );
  end if;

  return next v_transaction;
end;
$$;

create or replace function public.generate_recurring_request(
  p_plan_id uuid,
  p_occurrence_number int,
  p_payment_code text,
  p_payment_link text,
  p_solana_reference text,
  p_due_at timestamptz
) returns public.payment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.recurring_payment_plans;
  v_request public.payment_requests;
begin
  select * into v_plan from public.recurring_payment_plans where id = p_plan_id for update;
  if not found or not v_plan.active then
    return null;
  end if;

  select * into v_request
  from public.payment_requests
  where recurring_plan_id = p_plan_id and recurring_occurrence_number = p_occurrence_number;
  if found then
    return v_request;
  end if;

  insert into public.payment_requests (
    user_id, customer_id, wallet_id, payment_code, amount, description, note,
    expiry_option, expires_at, payment_link, solana_reference, due_at, currency, network,
    allow_partial_payments, deposit_type, deposit_value,
    recurring_plan_id, recurring_occurrence_number
  ) values (
    v_plan.user_id, v_plan.customer_id, null, p_payment_code, v_plan.amount, v_plan.description, v_plan.note,
    'never', null, p_payment_link, p_solana_reference, p_due_at, v_plan.currency, v_plan.network,
    v_plan.allow_partial_payments, v_plan.deposit_type, v_plan.deposit_value,
    p_plan_id, p_occurrence_number
  )
  returning * into v_request;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (v_plan.user_id, v_request.id, 'created');

  insert into public.notifications (user_id, type, title, message, entity_type, entity_id)
  values (
    v_plan.user_id,
    'recurring_generated',
    'Recurring request generated',
    trim(trailing '.' from trim(trailing '0' from v_plan.amount::text)) || ' ' || v_plan.currency || ' request ' || p_payment_code || ' was generated.',
    'request',
    v_request.id
  );

  update public.recurring_payment_plans
  set occurrences_generated = occurrences_generated + 1,
      active = case
        when v_plan.max_occurrences is not null and v_plan.occurrences_generated + 1 >= v_plan.max_occurrences then false
        else active
      end
  where id = p_plan_id;

  return v_request;
end;
$$;
