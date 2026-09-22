-- Phase 6C: Activity & Notification Center.
--
-- A NEW, minimal, dedicated `notifications` table -- deliberately NOT
-- bolted onto `request_events` (audited first; see the phase report). Three
-- reasons: (1) `request_events` requires a non-null `payment_request_id`,
-- but a "customer added" notification has no request to attach to; (2)
-- `request_events` is consumed by Request Detail's own Timeline today --
-- adding notification-only concerns (is_read) to it risks that unrelated
-- feature; (3) unread state needs to apply uniformly across every
-- notification type, including non-request ones. This table stores no
-- financial data itself (no amounts, no wallet addresses) -- only a
-- reference (entity_type/entity_id) plus human-readable text, exactly the
-- "do not duplicate financial data" rule the spec asks for. The real
-- amount is still only ever read from `transactions`/`payment_requests`.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'payment_received',
    'payment_partial',
    'request_viewed',
    'request_expired',
    'reminder_sent',
    'reminder_failed',
    'recurring_generated',
    'customer_added'
  )),
  title text not null,
  message text,
  entity_type text check (entity_type in ('request', 'customer')),
  entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id, is_read);

alter table public.notifications enable row level security;

-- A merchant may only ever read/update their own notifications -- never
-- another user's (spec's core security requirement).
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);

-- Update is scoped to own rows only, same posture request_events' own
-- "own row" update policy already has in this codebase (0002) -- in
-- practice the only field any client code ever changes is is_read (marking
-- read/unread), enforced by convention rather than a column-level grant,
-- matching the existing precedent rather than introducing a new one.
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id);

-- Every notification type EXCEPT 'customer_added' is inserted only via a
-- SECURITY DEFINER function (below) or a service-role Edge Function, after
-- the real underlying event has already been authoritatively confirmed
-- server-side -- never optimistically by the client (spec's core rule).
-- 'customer_added' is the one deliberate exception: creating a customer IS
-- itself a plain, already-successful authenticated write (no server
-- verification step exists or is meaningful for it), so logging it
-- immediately after is not optimistic -- the underlying fact already
-- happened. The `with check` clause locks this down to that single type,
-- for the caller's own account only -- a client can never insert any other
-- notification type directly.
create policy notifications_insert_customer_added on public.notifications
  for insert with check (auth.uid() = user_id and type = 'customer_added');

revoke all on public.notifications from anon;

-- 1. Payment received / partial payment received -----------------------
-- Appended to the EXISTING complete_verified_payment body (0012) verbatim
-- -- the crediting logic, duplicate-tx-hash guard, and status transition
-- above this comment are completely unchanged. Only the two new INSERTs
-- at the end are new. Same signature as 0012 -- CREATE OR REPLACE (no
-- DROP) so the existing revoke-all-from-public/anon/authenticated ACL from
-- 0012 is preserved automatically rather than needing to be re-stated.
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
      v_amount_text || ' USDC received for ' || v_request.payment_code || '.',
      'request',
      p_request_id
    );
  else
    insert into public.notifications (user_id, type, title, message, entity_type, entity_id)
    values (
      v_request.user_id,
      'payment_partial',
      'Partial payment received',
      v_amount_text || ' USDC received for ' || v_request.payment_code || '.',
      'request',
      p_request_id
    );
  end if;

  return next v_transaction;
end;
$$;

-- 2. Recurring request generated -----------------------------------------
-- Same signature as 0012 -- CREATE OR REPLACE preserves its existing
-- service-role-only ACL. Body identical up through the existing
-- request_events insert; only the new notifications insert is appended.
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
    trim(trailing '.' from trim(trailing '0' from v_plan.amount::text)) || ' USDC request ' || p_payment_code || ' was generated.',
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

-- 3. Request viewed (public checkout) -------------------------------------
-- Deliberately a SEPARATE new function rather than folding this into
-- get_public_payment_request: that function is declared `stable` (a
-- semantic promise of no side effects) and is polled every few seconds
-- while a checkout page is open (usePublicCheckoutPolling) -- adding a
-- write there would both violate its declared volatility and record a
-- flood of "viewed" events, one per poll. This function is called ONCE by
-- the client (on the public checkout screen's initial mount, not on every
-- poll tick) and is independently idempotent regardless (the `where not
-- exists` guard below), so even a duplicate/retried call is safe. Looks up
-- the request by its own public_token server-side -- never trusts a
-- client-supplied user_id -- same safety pattern as get_public_payment_request.
create or replace function public.record_request_viewed(p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.payment_requests;
begin
  select * into v_request from public.payment_requests where public_token = p_token;
  if not found then
    return;
  end if;

  if exists (
    select 1 from public.notifications
    where user_id = v_request.user_id and type = 'request_viewed' and entity_type = 'request' and entity_id = v_request.id
  ) then
    return;
  end if;

  insert into public.notifications (user_id, type, title, message, entity_type, entity_id)
  values (
    v_request.user_id,
    'request_viewed',
    'Request viewed',
    'Your customer opened the payment link for ' || v_request.payment_code || '.',
    'request',
    v_request.id
  );
end;
$$;

revoke all on function public.record_request_viewed(uuid) from public;
grant execute on function public.record_request_viewed(uuid) to anon;
grant execute on function public.record_request_viewed(uuid) to authenticated;

-- 4. Request expired -------------------------------------------------------
-- 'expired' is never actually written to payment_requests.status anywhere
-- in this codebase (see verify-payment/index.ts's own comment) -- expiry is
-- always a derived, point-in-time fact (isRequestExpired()). There is no
-- background sweep that detects expiry today, so this is triggered by the
-- MERCHANT's own client noticing (on load/refresh) that one of their
-- requests is now past expires_at -- but it never trusts that client-side
-- observation blindly: this function re-derives expiry from the real
-- expires_at column itself before inserting anything, the same
-- "server re-validates, client only triggers" pattern verify-payment's own
-- polling-triggered sweep already uses. security definer (bypasses RLS to
-- insert into notifications), but the WHERE clause enforces
-- user_id = auth.uid() itself, so a caller can only ever record this for
-- their OWN requests -- the same ownership-in-body pattern
-- cancel_payment_request (0017) already established. Idempotent: returns
-- false and inserts nothing if already recorded, or if the request isn't
-- genuinely expired.
create or replace function public.record_request_expired_notification(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.payment_requests;
begin
  select * into v_request
  from public.payment_requests
  where id = p_request_id
    and user_id = auth.uid()
    and status = 'pending'
    and expires_at is not null
    and expires_at <= now();

  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.notifications
    where user_id = v_request.user_id and type = 'request_expired' and entity_type = 'request' and entity_id = v_request.id
  ) then
    return false;
  end if;

  insert into public.notifications (user_id, type, title, message, entity_type, entity_id)
  values (
    v_request.user_id,
    'request_expired',
    'Request expired',
    v_request.payment_code || ' expired without payment.',
    'request',
    v_request.id
  );

  return true;
end;
$$;

revoke all on function public.record_request_expired_notification(uuid) from public, anon;
grant execute on function public.record_request_expired_notification(uuid) to authenticated;
