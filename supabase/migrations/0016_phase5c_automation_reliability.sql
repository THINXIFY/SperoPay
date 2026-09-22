-- Phase 5C: Notifications, Automation Reliability & Premium UI.
--
-- Audit finding 1: recurring_payment_plans has no way to tell "this plan
-- has been failing to generate" from "this plan is healthy" -- the
-- process-recurring-plans Edge Function already catches generation errors
-- per-plan (see that file), but simply lets the plan get reclaimed and
-- retried forever with zero persisted signal. A merchant-visible "Needs
-- Attention" surface (Automation Overview) needs a real, RLS-scoped column
-- to read -- these three are additive and default to "healthy", so every
-- existing plan is unaffected until it actually fails a generation attempt.
alter table public.recurring_payment_plans
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists last_error text,
  add column if not exists last_attempted_at timestamptz;

-- Audit finding 2: none of process-reminders, process-recurring-plans, or
-- verify-payment's sweep mode leave any queryable trace of "did the last
-- scheduled run actually happen, and what did it do" -- the only signal
-- today is the JSON response handed back to whatever invoked them, which
-- pg_cron does not store or surface anywhere. This table is a system-level
-- operational log, not a merchant record: one invocation processes every
-- merchant's due work at once, so "whose row is this" doesn't apply the way
-- it does to every other table in this project, and it is NOT exposed to
-- the merchant app (see the RLS section below) -- it exists so the project
-- owner can check cron health directly via SQL, e.g.:
--   select * from automation_runs order by started_at desc limit 20;
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  function_name text not null check (function_name in ('process-reminders', 'process-recurring-plans', 'verify-payment-sweep')),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  claimed_count integer not null default 0,
  succeeded_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  -- A short, stable machine reason for a run that errored before it could
  -- finish normally (e.g. "claim_failed") -- never a raw stack trace or
  -- exception message, same discipline as payment_reminders.last_error.
  error text
);

create index if not exists idx_automation_runs_function_started
  on public.automation_runs (function_name, started_at desc);

-- RLS enabled with NO policies at all: PostgREST denies every operation to
-- every role except service_role (which bypasses RLS entirely) by default
-- in that state. That is exactly and only what should be able to touch
-- this table -- the three Edge Functions write to it with the service-role
-- key; no anon/authenticated grant is ever added, so it can never leak into
-- the merchant app's own Supabase queries even by an application bug.
alter table public.automation_runs enable row level security;
