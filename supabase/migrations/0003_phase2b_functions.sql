-- Phase 2B: the multi-write "one logical action" operations, as SECURITY
-- INVOKER functions (RLS still applies inside — the caller must already own
-- every row it touches). No SECURITY DEFINER anywhere in this phase: every
-- caller of these functions is always the request's own owner (see design
-- doc 3.7 — the public payment page's backend is explicitly deferred, not
-- built, so no cross-user privileged path is needed yet).
--
-- deleteRequest is NOT a function here: ON DELETE CASCADE on request_events
-- and transactions already makes a plain RLS-guarded DELETE FROM
-- payment_requests atomic and complete on its own.

create or replace function public.create_payment_request(
  p_customer_id uuid,
  p_wallet_id uuid,
  p_payment_code text,
  p_amount numeric,
  p_description text,
  p_note text,
  p_expiry_option text,
  p_expires_at timestamptz,
  p_payment_link text
) returns public.payment_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.payment_requests;
begin
  -- FK constraints alone don't check ownership (they only check the row
  -- exists, and FK validation runs with elevated privilege regardless of
  -- RLS) — an authenticated caller who guessed another user's customer/
  -- wallet UUID could otherwise attach it to their own request.
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
    expiry_option, expires_at, payment_link
  ) values (
    auth.uid(), p_customer_id, p_wallet_id, p_payment_code, p_amount, p_description, p_note,
    p_expiry_option, p_expires_at, p_payment_link
  )
  returning * into v_request;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (auth.uid(), v_request.id, 'created');

  return v_request;
end;
$$;

create or replace function public.begin_payment_confirmation(p_request_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated int;
begin
  update public.payment_requests
  set status = 'confirming'
  where id = p_request_id
    and user_id = auth.uid()
    and status = 'pending'
    and (expires_at is null or expires_at > now());

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (auth.uid(), p_request_id, 'payment_detected');

  return true;
end;
$$;

-- returns setof (not a bare composite): PostgREST invokes non-setof
-- composite-returning functions as `select * from f()`, and in Postgres
-- `select * from f()` where f `return null`s a bare composite yields ONE
-- row with every column null — not zero rows. That would make the client
-- see a truthy, all-null "transaction" on both the not-found and
-- p_should_fail branches. setof + a bare `return;` (no `return next`)
-- gives an unambiguous empty result set instead.
create or replace function public.complete_payment(
  p_request_id uuid,
  p_should_fail boolean,
  p_tx_hash text
) returns setof public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.payment_requests;
  v_transaction public.transactions;
begin
  select * into v_request
  from public.payment_requests
  where id = p_request_id and user_id = auth.uid() and status = 'confirming'
  for update;

  if not found then
    return;
  end if;

  if p_should_fail then
    update public.payment_requests set status = 'pending' where id = p_request_id;
    insert into public.request_events (user_id, payment_request_id, event_type)
    values (auth.uid(), p_request_id, 'payment_failed');
    return;
  end if;

  insert into public.transactions (user_id, payment_request_id, from_customer_id, amount, currency, network, tx_hash)
  values (auth.uid(), p_request_id, v_request.customer_id, v_request.amount, v_request.currency, v_request.network, p_tx_hash)
  returning * into v_transaction;

  update public.payment_requests set status = 'paid' where id = p_request_id;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (auth.uid(), p_request_id, 'payment_confirmed');

  return next v_transaction;
end;
$$;

create or replace function public.cancel_payment_request(p_request_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated int;
begin
  update public.payment_requests
  set status = 'cancelled'
  where id = p_request_id
    and user_id = auth.uid()
    and status not in ('paid', 'expired', 'cancelled');

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (auth.uid(), p_request_id, 'cancelled');

  return true;
end;
$$;

grant execute on function public.create_payment_request to authenticated;
grant execute on function public.begin_payment_confirmation to authenticated;
grant execute on function public.complete_payment to authenticated;
grant execute on function public.cancel_payment_request to authenticated;
