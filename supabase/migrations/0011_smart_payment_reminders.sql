-- Phase 4A: Smart Payment Reminders. An additive business layer on top of
-- the existing payment system -- nothing here modifies create_payment_request,
-- begin_payment_confirmation, complete_payment, mark_payment_detected, or
-- complete_verified_payment (0003/0007). Reminders react to payment state
-- via a trigger, they never gate or alter it.

-- due_at is a genuinely separate concept from expires_at: expires_at is
-- when the *checkout link itself* stops accepting payment (a Solana Pay/
-- QR concern), due_at is when the merchant expects to be paid by (a
-- reminder-scheduling concern). A request can have a due date with no
-- expiry ("never" expires but still due Friday), or an expiry with no due
-- date set (existing requests, or a merchant who doesn't need reminders).
-- Nullable and independent of expiry_option/expires_at.
alter table public.payment_requests add column if not exists due_at timestamptz;

-- Re-declared with one added parameter, exactly the same way 0006 already
-- extended this function to add p_solana_reference (default null, appended
-- at the end) -- every existing caller that doesn't pass p_due_at is
-- completely unaffected; create_payment_request's own validation and
-- 'created' event logging are otherwise untouched, character for character.
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
  p_due_at timestamptz default null
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
    expiry_option, expires_at, payment_link, solana_reference, due_at
  ) values (
    auth.uid(), p_customer_id, p_wallet_id, p_payment_code, p_amount, p_description, p_note,
    p_expiry_option, p_expires_at, p_payment_link, p_solana_reference, p_due_at
  )
  returning * into v_request;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (auth.uid(), v_request.id, 'created');

  return v_request;
end;
$$;

grant execute on function public.create_payment_request(
  uuid, uuid, text, numeric, text, text, text, timestamptz, text, text, timestamptz
) to authenticated;

-- A template's reminder default. reminders_enabled already exists (0010,
-- the on/off switch); this adds *which* schedule to apply when on.
-- custom_rules is only populated/read when preset = 'custom' -- an array
-- of {type, offsetValue, offsetUnit} objects, the same shape a request's
-- own schedule uses (see payment_reminder_schedules.custom_rules below),
-- so both are computed by the identical client-side function.
alter table public.payment_templates
  add column if not exists reminder_preset text not null default 'standard'
    check (reminder_preset in ('gentle','standard','frequent','custom')),
  add column if not exists reminder_custom_rules jsonb;

-- request_events.event_type already allows 'reminder_sent' (0001) --
-- unused until now. Widened here to also cover the schedule lifecycle
-- itself, so "a reminder was scheduled/failed/stopped" is as visible in
-- the timeline as "a reminder was sent". Constraint is unnamed in 0001
-- (Postgres auto-names it `request_events_event_type_check`), dropped and
-- recreated with the wider list -- existing rows are unaffected since
-- every existing value remains valid.
alter table public.request_events drop constraint if exists request_events_event_type_check;
alter table public.request_events add constraint request_events_event_type_check
  check (event_type in (
    'created','shared','payment_detected','payment_confirmed','payment_failed',
    'reminder_sent','reminder_scheduled','reminder_failed','reminder_cancelled',
    'cancelled','expired'
  ));

-- One row per payment_request (unique payment_request_id -- a request has
-- at most one active schedule, re-saving edits it rather than creating a
-- second one). send_hour/send_minute + a real IANA timezone (never a bare
-- UTC offset -- DST and travel make offsets wrong within months) are
-- resolved to UTC instants client-side when (re)computing
-- payment_reminders rows; storing the timezone here (not just baking it
-- into scheduled_for) is what lets "Manage reminders" show the schedule
-- correctly if reopened later and lets a future "change send time" edit
-- recompute everything from a known-good source of truth.
create table if not exists public.payment_reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_request_id uuid not null unique references public.payment_requests(id) on delete cascade,
  enabled boolean not null default true,
  preset text not null default 'standard' check (preset in ('gentle','standard','frequent','custom')),
  custom_rules jsonb,
  send_hour smallint not null default 10 check (send_hour between 0 and 23),
  send_minute smallint not null default 0 check (send_minute between 0 and 59),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every individual reminder occurrence -- both future scheduled ones and
-- a permanent history of past ones (manual sends included: a manual "Send
-- reminder now" tap inserts a row here too, already-sent, rather than
-- living only as a request_events row -- one source of truth for "when
-- was this customer reminded and how", not two systems that can drift.
create table if not exists public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_request_id uuid not null references public.payment_requests(id) on delete cascade,
  schedule_id uuid references public.payment_reminder_schedules(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('before_due','on_due','after_due','manual')),
  offset_value integer not null default 0,
  offset_unit text not null default 'days' check (offset_unit in ('days','weeks')),
  scheduled_for timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','processing','sent','failed','skipped','cancelled')),
  delivery_channel text,
  sent_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotency at the schema level (not just application discipline): the
  -- same computed occurrence for the same request can only exist once.
  -- Guards against e.g. a double-tap on "Save" in the reminder form
  -- inserting the same schedule twice.
  unique (payment_request_id, reminder_type, offset_value, offset_unit, scheduled_for)
);

create index if not exists idx_payment_reminders_due
  on public.payment_reminders (scheduled_for)
  where status = 'scheduled';
create index if not exists idx_payment_reminders_request on public.payment_reminders(payment_request_id);
create index if not exists idx_payment_reminder_schedules_request on public.payment_reminder_schedules(payment_request_id);

alter table public.payment_reminder_schedules enable row level security;
alter table public.payment_reminders enable row level security;

drop policy if exists "payment_reminder_schedules_select_own" on public.payment_reminder_schedules;
create policy "payment_reminder_schedules_select_own" on public.payment_reminder_schedules for select using (auth.uid() = user_id);
drop policy if exists "payment_reminder_schedules_insert_own" on public.payment_reminder_schedules;
create policy "payment_reminder_schedules_insert_own" on public.payment_reminder_schedules for insert with check (auth.uid() = user_id);
drop policy if exists "payment_reminder_schedules_update_own" on public.payment_reminder_schedules;
create policy "payment_reminder_schedules_update_own" on public.payment_reminder_schedules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "payment_reminder_schedules_delete_own" on public.payment_reminder_schedules;
create policy "payment_reminder_schedules_delete_own" on public.payment_reminder_schedules for delete using (auth.uid() = user_id);

drop policy if exists "payment_reminders_select_own" on public.payment_reminders;
create policy "payment_reminders_select_own" on public.payment_reminders for select using (auth.uid() = user_id);
drop policy if exists "payment_reminders_insert_own" on public.payment_reminders;
create policy "payment_reminders_insert_own" on public.payment_reminders for insert with check (auth.uid() = user_id);
drop policy if exists "payment_reminders_update_own" on public.payment_reminders;
create policy "payment_reminders_update_own" on public.payment_reminders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "payment_reminders_delete_own" on public.payment_reminders;
create policy "payment_reminders_delete_own" on public.payment_reminders for delete using (auth.uid() = user_id);

drop trigger if exists trg_payment_reminder_schedules_updated_at on public.payment_reminder_schedules;
create trigger trg_payment_reminder_schedules_updated_at before update on public.payment_reminder_schedules
  for each row execute function public.set_updated_at();
drop trigger if exists trg_payment_reminders_updated_at on public.payment_reminders;
create trigger trg_payment_reminders_updated_at before update on public.payment_reminders
  for each row execute function public.set_updated_at();

-- Stop-when-paid/cancelled, enforced at the database layer so it applies
-- no matter which existing code path changes the status (the mock
-- complete_payment RPC, or the real complete_verified_payment/
-- mark_payment_detected functions the verify-payment Edge Function calls)
-- -- this trigger requires editing none of them. 'confirming' is
-- deliberately NOT handled here: a reminder whose scheduled_for has
-- already arrived while the request is confirming is simply left
-- 'scheduled' and re-evaluated (and skipped) by the processor's own
-- eligibility check on the next run -- see process-reminders/index.ts --
-- so if confirmation fails and complete_payment reverts status to
-- 'pending' (its actual failure behavior -- there is no separate "failed"
-- status), reminders resume on their own with no special-case "un-pause"
-- logic needed here.
create or replace function public.cancel_reminders_on_terminal_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('paid', 'cancelled') and new.status is distinct from old.status then
    update public.payment_reminders
    set status = 'cancelled', updated_at = now()
    where payment_request_id = new.id
      and status in ('scheduled', 'processing');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_requests_cancel_reminders on public.payment_requests;
create trigger trg_payment_requests_cancel_reminders
  after update of status on public.payment_requests
  for each row execute function public.cancel_reminders_on_terminal_status();

-- The one concurrency-safe entry point the reminder processor (a Supabase
-- Edge Function, invoked by a scheduled cron trigger) uses to pick up due
-- work: `for update skip locked` inside the derived table means two
-- concurrent invocations can never claim the same row (the second simply
-- skips whatever the first has locked, rather than blocking or double-
-- claiming) -- this is the actual concurrency guarantee, not an
-- `if status = 'scheduled'` check in application code, which would have a
-- race window between reading and writing. A reminder stuck 'processing'
-- for more than 5 minutes (a crashed/timed-out invocation) is eligible to
-- be reclaimed, so one failed run can't strand a reminder forever.
create or replace function public.claim_due_reminders(p_limit int default 25)
returns setof public.payment_reminders
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.payment_reminders r
  set status = 'processing', updated_at = now()
  from (
    select id from public.payment_reminders
    where scheduled_for <= now()
      and (
        status = 'scheduled'
        or (status = 'processing' and updated_at < now() - interval '5 minutes')
      )
    order by scheduled_for asc
    limit p_limit
    for update skip locked
  ) claimed
  where r.id = claimed.id
  returning r.*;
end;
$$;

-- service_role only (the Edge Function's own credential, never shipped to
-- the app -- see src/services below) -- no anon/authenticated grant, same
-- posture as 0007's mark_payment_detected/complete_verified_payment.
revoke all on function public.claim_due_reminders(int) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(int) to service_role;
