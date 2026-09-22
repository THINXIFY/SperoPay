-- Phase 4B + 4C: Recurring Payment Requests + Partial Payments/Deposits.
-- Additive on top of the existing payment system -- create_payment_request,
-- begin_payment_confirmation, cancel_payment_request, mark_payment_detected
-- and the Smart Reminders schema (0011) are all untouched. complete_payment
-- (the merchant-only "simulate payment" demo path) is also untouched: it
-- always credits the full request amount, which remains correct behavior
-- for it -- Phase 4C's partial-payment support applies to real, Solana-
-- verified payments only. complete_verified_payment IS extended below,
-- which is the "integration required" exception the spec explicitly allows.

-- 1. The schema-level blocker found during audit --------------------------
-- transactions.payment_request_id currently has a UNIQUE constraint (0001),
-- meaning today's schema physically cannot record more than one payment
-- against a request. Partial payments require multiple transaction rows
-- per request, so this must be dropped. The plain (non-unique) index
-- idx_transactions_payment_request_id already exists separately (0001) and
-- keeps lookups by request just as fast -- nothing else relies on this
-- constraint: complete_payment's own status='confirming' guard, not this
-- constraint, is what already prevented double-crediting the mock flow.
alter table public.transactions drop constraint if exists transactions_payment_request_id_key;

-- 2. Partial payment configuration on payment_requests ---------------------
-- allow_partial_payments defaults false -- every request that exists today,
-- and every new full-payment-only request, behaves exactly as before:
-- complete_verified_payment's exact-amount-match path (see below) is
-- untouched when this is false. deposit_type/deposit_value are only
-- meaningful when allow_partial_payments is true, and only apply to a
-- request's very first credited payment (see complete_verified_payment).
alter table public.payment_requests
  add column if not exists allow_partial_payments boolean not null default false,
  add column if not exists deposit_type text check (deposit_type in ('fixed','percentage')),
  add column if not exists deposit_value numeric(22,6) check (deposit_value is null or deposit_value > 0);

-- 2b. Let a merchant configure partial payments at creation time -----------
-- A plain request (not recurring-generated) also needs these settable at
-- creation -- generate_recurring_request (below) inserts them directly for
-- a recurring-generated request, but the ordinary Create Request flow goes
-- through this RPC, so it needs the same three fields appended the same
-- additive way 0011 just fixed itself: drop the exact old (11-argument,
-- post-0011-fix) signature first, since adding parameters always changes
-- a function's identity in Postgres.
drop function if exists public.create_payment_request(
  uuid, uuid, text, numeric, text, text, text, timestamptz, text, text, timestamptz
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
  p_deposit_value numeric default null
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
    expiry_option, expires_at, payment_link, solana_reference, due_at,
    allow_partial_payments, deposit_type, deposit_value
  ) values (
    auth.uid(), p_customer_id, p_wallet_id, p_payment_code, p_amount, p_description, p_note,
    p_expiry_option, p_expires_at, p_payment_link, p_solana_reference, p_due_at,
    p_allow_partial_payments, p_deposit_type, p_deposit_value
  )
  returning * into v_request;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (auth.uid(), v_request.id, 'created');

  return v_request;
end;
$$;

grant execute on function public.create_payment_request(
  uuid, uuid, text, numeric, text, text, text, timestamptz, text, text, timestamptz, boolean, text, numeric
) to authenticated;

-- 3. Recurring payment plans -------------------------------------------------
-- One row per merchant-configured recurring schedule. A plan never IS a
-- payment_request -- it only ever generates independent ones (see
-- generate_recurring_request below), which is what keeps "changing a
-- template/plan later must not rewrite historical requests" true by
-- construction: a generated request copies these values in at insert time
-- and never reads back from the plan again.
--
-- next_run_at (a real UTC instant, resolved from `timezone` at compute time
-- -- never a bare offset, same DST/travel-safety reason as 0011's reminder
-- schedules) plus processing_locked_until (this table's own claim-lock,
-- deliberately separate from the merchant-facing `active` on/off toggle so
-- "paused by the merchant" and "currently being processed by the cron
-- claim" can never be confused with each other) are what the server-side
-- processor uses -- see claim_due_recurring_plans.
create table if not exists public.recurring_payment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  amount numeric(22,6) not null check (amount > 0),
  currency text not null default 'USDC',
  network text not null default 'Solana',
  description text,
  note text,
  frequency text not null check (frequency in ('weekly','biweekly','monthly','quarterly','yearly','custom')),
  custom_interval_days integer check (custom_interval_days is null or custom_interval_days > 0),
  due_date_offset_days integer check (due_date_offset_days is null or due_date_offset_days >= 0),
  start_date date not null,
  end_date date,
  max_occurrences integer check (max_occurrences is null or max_occurrences > 0),
  occurrences_generated integer not null default 0,
  next_run_at timestamptz not null,
  -- send_hour/send_minute mirror payment_reminder_schedules' own fields
  -- exactly (0011) -- the wall-clock time of day, in `timezone`, this plan
  -- generates at. Storing them (rather than re-deriving from next_run_at
  -- each time) is what lets computing the occurrence AFTER next_run_at
  -- start from a known-good source of truth instead of reverse-engineering
  -- a time-of-day out of a UTC instant.
  send_hour smallint not null default 9 check (send_hour between 0 and 23),
  send_minute smallint not null default 0 check (send_minute between 0 and 59),
  timezone text not null default 'UTC',
  active boolean not null default true,
  processing_locked_until timestamptz,
  allow_partial_payments boolean not null default false,
  deposit_type text check (deposit_type in ('fixed','percentage')),
  deposit_value numeric(22,6) check (deposit_value is null or deposit_value > 0),
  reminders_enabled boolean not null default true,
  reminder_preset text not null default 'standard' check (reminder_preset in ('gentle','standard','frequent','custom')),
  reminder_custom_rules jsonb,
  -- Informational only (see comment above) -- deliberately no FK-driven
  -- cascade behavior beyond "don't orphan-reference a deleted template".
  source_template_id uuid references public.payment_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. What a generated request must be traceable back to --------------------
-- recurring_occurrence_number is the plan's own idempotency key: "occurrence
-- 7 of plan X" can only ever exist once, enforced below by a real unique
-- index, not just application discipline (mirrors 0011's identical
-- reasoning for payment_reminders' own unique constraint).
alter table public.payment_requests
  add column if not exists recurring_plan_id uuid references public.recurring_payment_plans(id) on delete set null,
  add column if not exists recurring_occurrence_number integer;

create unique index if not exists idx_payment_requests_recurring_occurrence
  on public.payment_requests (recurring_plan_id, recurring_occurrence_number)
  where recurring_plan_id is not null;

create index if not exists idx_recurring_payment_plans_user_id on public.recurring_payment_plans(user_id);
create index if not exists idx_recurring_payment_plans_due
  on public.recurring_payment_plans (next_run_at)
  where active = true;
create index if not exists idx_payment_requests_recurring_plan_id on public.payment_requests(recurring_plan_id);

alter table public.recurring_payment_plans enable row level security;

drop policy if exists "recurring_payment_plans_select_own" on public.recurring_payment_plans;
create policy "recurring_payment_plans_select_own" on public.recurring_payment_plans for select using (auth.uid() = user_id);
drop policy if exists "recurring_payment_plans_insert_own" on public.recurring_payment_plans;
create policy "recurring_payment_plans_insert_own" on public.recurring_payment_plans for insert with check (auth.uid() = user_id);
drop policy if exists "recurring_payment_plans_update_own" on public.recurring_payment_plans;
create policy "recurring_payment_plans_update_own" on public.recurring_payment_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recurring_payment_plans_delete_own" on public.recurring_payment_plans;
create policy "recurring_payment_plans_delete_own" on public.recurring_payment_plans for delete using (auth.uid() = user_id);

drop trigger if exists trg_recurring_payment_plans_updated_at on public.recurring_payment_plans;
create trigger trg_recurring_payment_plans_updated_at before update on public.recurring_payment_plans
  for each row execute function public.set_updated_at();

-- 5. Concurrency-safe claim, mirroring claim_due_reminders' proven pattern
-- (0011) -- FOR UPDATE SKIP LOCKED so two concurrent processor invocations
-- can never claim the same plan, and a 5-minute stuck-processing window so
-- a crashed invocation can't strand a plan forever. This is the SAME
-- architecture as the reminder processor reused cleanly, not a coupling --
-- recurring plans and reminders remain two entirely independent tables.
create or replace function public.claim_due_recurring_plans(p_limit int default 25)
returns setof public.recurring_payment_plans
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.recurring_payment_plans p
  set processing_locked_until = now() + interval '5 minutes', updated_at = now()
  from (
    select id from public.recurring_payment_plans
    where active = true
      and next_run_at <= now()
      and (processing_locked_until is null or processing_locked_until < now())
      and (max_occurrences is null or occurrences_generated < max_occurrences)
      and (end_date is null or next_run_at::date <= end_date)
    order by next_run_at asc
    limit p_limit
    for update skip locked
  ) claimed
  where p.id = claimed.id
  returning p.*;
end;
$$;

revoke all on function public.claim_due_recurring_plans(int) from public, anon, authenticated;
grant execute on function public.claim_due_recurring_plans(int) to service_role;

-- 6. The one atomic request-generation step ---------------------------------
-- Idempotent two ways at once: the explicit existence check below (the
-- ordinary, fast path) and the unique index from step 4 (the hard backstop
-- if this function is somehow invoked twice for the same occurrence
-- concurrently -- the second insert simply fails the unique constraint
-- rather than creating a duplicate request). SECURITY DEFINER + service_role
-- only, the same posture as 0011's claim_due_reminders: the caller (the
-- process-recurring-plans Edge Function) has no auth.uid() session, it acts
-- on behalf of whichever plan's user_id it's processing.
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

  -- A plan that has just generated its final occurrence stops being
  -- "active" immediately rather than silently sitting active-but-never-
  -- claimable again (claim_due_recurring_plans already excludes it from
  -- future claims via the same max_occurrences check, but flipping this
  -- here is what lets the UI show "Ended" instead of "Active" forever).
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

revoke all on function public.generate_recurring_request(uuid, int, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.generate_recurring_request(uuid, int, text, text, text, timestamptz) to service_role;

-- 7. Partial-payment-aware crediting -----------------------------------------
-- Re-declared with one appended parameter, the same additive pattern 0006
-- and 0011 already used to extend other functions -- p_amount defaulting to
-- null preserves the exact old behavior (credit v_request.amount in full)
-- for any caller that doesn't pass it, though the real caller
-- (verify-payment) is updated below to always pass the actual verified
-- on-chain amount.
--
-- The critical change: status is no longer unconditionally set to 'paid'.
-- It's set to 'paid' only once the running total (every non-cancelled
-- transaction ever credited to this request, summed in exact numeric
-- arithmetic -- Postgres `numeric` is exact decimal, never float) reaches
-- the request's full amount; otherwise it's explicitly reset to 'pending'
-- so the SAME request can be detected and credited again for its next
-- installment. "Partially Paid" itself is never stored here or anywhere --
-- it stays a pure client-side derivation (src/utils/paymentAccounting.ts)
-- from real transaction rows, exactly as required.
--
-- Adding a parameter changes the function's signature, so CREATE OR REPLACE
-- alone would leave 0007's original 2-argument version behind as a stale,
-- separately-callable overload (a call omitting p_amount would become
-- genuinely ambiguous, not silently fall back to it) -- drop the exact old
-- signature first, the same lesson applied to create_payment_request in 0011.
drop function if exists public.complete_verified_payment(uuid, text);

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

  if v_total_paid >= v_request.amount then
    insert into public.request_events (user_id, payment_request_id, event_type)
    values (v_request.user_id, p_request_id, 'payment_confirmed');
  end if;

  return next v_transaction;
end;
$$;

-- The DROP above destroyed the old function object and its ACLs along with
-- it (0007's own revoke does not carry over to this new one -- Postgres
-- grants EXECUTE to PUBLIC by default on a newly created function). Without
-- this, the new 3-argument version would be callable by anon/authenticated
-- by default, letting any signed-in user credit an arbitrary payment --
-- re-establish the exact same service-role-only posture 0007 originally set.
revoke all on function public.complete_verified_payment(uuid, text, numeric) from public, anon, authenticated;

-- 8. Public checkout: partial-payment fields + server-derived accounting ---
-- Widening RETURNS TABLE's column list requires drop-then-create (Postgres
-- rejects CREATE OR REPLACE when the output shape differs -- same reason
-- 0009 had to do this when it added merchant_logo_url) -- exposes what the
-- checkout page needs to render "Amount due / Paid / Remaining" and
-- validate a chosen amount. verified_paid_amount and remaining_amount are
-- computed HERE, server-side, from real transactions, never trusted from
-- the client (spec's core accounting requirement).
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
  solana_reference text,
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
    pr.expires_at,
    coalesce(nullif(bp.business_name, ''), nullif(p.display_name, '')) as merchant_name,
    bp.logo_url as merchant_logo_url,
    w.address as destination_wallet,
    pr.solana_reference,
    pr.allow_partial_payments,
    pr.deposit_type,
    pr.deposit_value,
    coalesce(t.paid, 0) as verified_paid_amount,
    greatest(pr.amount - coalesce(t.paid, 0), 0) as remaining_amount
  from public.payment_requests pr
  join public.profiles p on p.id = pr.user_id
  left join public.business_profiles bp on bp.user_id = pr.user_id
  left join public.wallets w on w.user_id = pr.user_id
  left join lateral (
    select sum(amount) as paid from public.transactions where payment_request_id = pr.id
  ) t on true
  where pr.public_token = p_token;
end;
$$;

grant execute on function public.get_public_payment_request(uuid) to anon;
grant execute on function public.get_public_payment_request(uuid) to authenticated;
