-- Phase 3D: the two atomic, multi-write operations the verify-payment
-- Edge Function calls once it has independently confirmed a transaction
-- against the chain. Both functions are callable ONLY by the service role
-- -- there is no auth.uid() to check against (the Edge Function calls
-- these with the service-role key, which has no authenticated-user
-- session), so ownership is not enforced via RLS/auth.uid() the way every
-- other function in this project does it. Instead: no EXECUTE grant is
-- ever given to anon or authenticated, and this migration explicitly
-- revokes any default PUBLIC grant, so only service_role (which bypasses
-- function grants entirely, the same way it bypasses RLS) can invoke
-- them. This is what actually satisfies "no anonymous ability to
-- arbitrarily mark Paid" -- not an ownership check, since none is
-- possible here, but the complete absence of any caller-facing grant.

-- 1. Confirming: a matching transaction was found but is not yet at the
-- required confirmation level. Idempotent -- calling this repeatedly
-- while the same transaction is still confirming must not create
-- duplicate payment_detected events or re-run the status update
-- pointlessly (spec section 7).
create or replace function public.mark_payment_detected(p_request_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.payment_requests;
begin
  select * into v_request
  from public.payment_requests
  where id = p_request_id
    and status in ('pending', 'confirming')
    and (expires_at is null or expires_at > now())
  for update;

  if not found then
    return false;
  end if;

  if v_request.status = 'pending' then
    update public.payment_requests set status = 'confirming' where id = p_request_id;
  end if;

  if not exists (
    select 1 from public.request_events
    where payment_request_id = p_request_id and event_type = 'payment_detected'
  ) then
    insert into public.request_events (user_id, payment_request_id, event_type)
    values (v_request.user_id, p_request_id, 'payment_detected');
  end if;

  return true;
end;
$$;

-- 2. Paid: the atomic finalize (spec section 6). Re-derives amount/
-- currency/network/customer_id from the request row itself rather than
-- trusting any value the caller supplies -- the only untrusted input is
-- which request and which signature, both of which the Edge Function has
-- already independently verified against the chain before calling this.
-- returns setof (not a bare composite) for the same reason complete_payment
-- does: an empty result set on the not-found/already-credited branches,
-- never one row of all-nulls.
create or replace function public.complete_verified_payment(
  p_request_id uuid,
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
  where id = p_request_id
    and status in ('pending', 'confirming')
    and (expires_at is null or expires_at > now())
  for update;

  if not found then
    return;
  end if;

  -- Belt-and-suspenders: transactions.tx_hash's UNIQUE constraint
  -- (0005_phase3a_payment_foundation.sql) is the ultimate backstop against
  -- crediting the same signature twice, anywhere. Checking here turns the
  -- ordinary "already processed by a prior poll" case into a clean no-op
  -- instead of a raised unique_violation.
  if exists (select 1 from public.transactions where tx_hash = p_tx_hash) then
    return;
  end if;

  insert into public.transactions (user_id, payment_request_id, from_customer_id, amount, currency, network, tx_hash)
  values (v_request.user_id, p_request_id, v_request.customer_id, v_request.amount, v_request.currency, v_request.network, p_tx_hash)
  returning * into v_transaction;

  update public.payment_requests set status = 'paid' where id = p_request_id;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (v_request.user_id, p_request_id, 'payment_confirmed');

  return next v_transaction;
end;
$$;

revoke all on function public.mark_payment_detected(uuid) from public, anon, authenticated;
revoke all on function public.complete_verified_payment(uuid, text) from public, anon, authenticated;
