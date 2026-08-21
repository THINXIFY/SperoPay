-- Phase 2B: core tables for per-user cloud-backed business data.
-- profiles.id IS auth.users.id (one row per user); every other table has
-- an explicit user_id. No table is ever written by anything other than
-- the authenticated owner (see 0002_phase2b_rls.sql).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  country text not null default '',
  usage_type text check (usage_type in ('freelancer','business','creator','personal')),
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text,
  business_email text,
  website text,
  description text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- V1 is single-wallet-per-user (the table stays flexible for a future
-- multi-wallet feature via is_default, but the app only ever maintains one
-- row per user for now via an upsert keyed on user_id, hence the unique
-- constraint here rather than a separate ALTER TABLE).
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  network text not null default 'Solana',
  stablecoin text not null default 'USDC',
  address text not null,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  avatar_color text not null default 'blue' check (avatar_color in ('mint','lavender','blue','red')),
  company text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(18,2) not null check (amount > 0),
  description text,
  expiry_option text not null default '7d' check (expiry_option in ('1h','24h','7d','never')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  wallet_id uuid references public.wallets(id) on delete set null,
  payment_code text not null unique,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null default 'USDC',
  network text not null default 'Solana',
  description text,
  note text,
  expiry_option text not null default '7d' check (expiry_option in ('1h','24h','7d','never')),
  expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending','confirming','paid','expired','cancelled')),
  payment_link text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_request_id uuid not null references public.payment_requests(id) on delete cascade,
  event_type text not null check (event_type in ('created','shared','payment_detected','payment_confirmed','payment_failed','reminder_sent','cancelled','expired')),
  occurred_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_request_id uuid not null unique references public.payment_requests(id) on delete cascade,
  from_customer_id uuid references public.customers(id) on delete set null,
  amount numeric(18,2) not null,
  currency text not null default 'USDC',
  network text not null default 'Solana',
  tx_hash text not null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_business_profiles_user_id on public.business_profiles(user_id);
-- wallets.user_id already has an index via its unique constraint above.
create index if not exists idx_customers_user_id on public.customers(user_id);
create index if not exists idx_payment_templates_user_id on public.payment_templates(user_id);
create index if not exists idx_payment_requests_user_id on public.payment_requests(user_id);
create index if not exists idx_payment_requests_customer_id on public.payment_requests(customer_id);
create index if not exists idx_payment_requests_status on public.payment_requests(status);
create index if not exists idx_payment_requests_created_at on public.payment_requests(created_at);
create index if not exists idx_payment_requests_payment_code on public.payment_requests(payment_code);
create index if not exists idx_request_events_payment_request_id on public.request_events(payment_request_id);
create index if not exists idx_transactions_payment_request_id on public.transactions(payment_request_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- drop-then-create so this migration can be pasted more than once (e.g. a
-- retry after a partial failure) without erroring on "trigger already exists".
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists trg_business_profiles_updated_at on public.business_profiles;
create trigger trg_business_profiles_updated_at before update on public.business_profiles
  for each row execute function public.set_updated_at();
drop trigger if exists trg_wallets_updated_at on public.wallets;
create trigger trg_wallets_updated_at before update on public.wallets
  for each row execute function public.set_updated_at();
drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
drop trigger if exists trg_payment_templates_updated_at on public.payment_templates;
create trigger trg_payment_templates_updated_at before update on public.payment_templates
  for each row execute function public.set_updated_at();
drop trigger if exists trg_payment_requests_updated_at on public.payment_requests;
create trigger trg_payment_requests_updated_at before update on public.payment_requests
  for each row execute function public.set_updated_at();
