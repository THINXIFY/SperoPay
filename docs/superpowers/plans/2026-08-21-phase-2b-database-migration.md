# Phase 2B: Database Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Requests, Customers, Templates, Transactions, Request Events, Profile, Business Profile, and Wallet from local Zustand+AsyncStorage into per-user, RLS-enforced Supabase Postgres tables, closing the cross-user data leak, while preserving every existing screen's UX and the mock payment engine exactly.

**Architecture:** 8 tables, one reused RLS policy shape (`auth.uid() = user_id`, `profiles` uses `id` directly), 4 Postgres functions for the multi-write actions (`create_payment_request`, `begin_payment_confirmation`, `complete_payment`, `cancel_payment_request`), 7 Zustand stores rewritten to fetch/mutate through `supabase-js` instead of `persist`+AsyncStorage, one central `resetAllUserData()` cleared on every user-id change, and `onboardingStore` removed entirely in favor of `profiles.onboarding_completed`.

Full design rationale: `docs/superpowers/specs/2026-08-21-phase-2b-database-migration-design.md`

**Important — manual step required before Task 4 can be verified end-to-end:** Tasks 1-3 produce SQL files. They must be run in the Supabase Dashboard's SQL Editor (in order: schema, then RLS, then functions) before any Supabase-backed store code can be exercised against a real project. Automated tests never depend on this (mocked Supabase client throughout, matching the established `authStore.test.ts` convention) — but manual verification (Task 13) does.

---

### Task 1: Schema migration SQL

**Files:**
- Create: `supabase/migrations/0001_phase2b_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
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

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
create index if not exists idx_wallets_user_id on public.wallets(user_id);
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

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_business_profiles_updated_at before update on public.business_profiles
  for each row execute function public.set_updated_at();
create trigger trg_wallets_updated_at before update on public.wallets
  for each row execute function public.set_updated_at();
create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger trg_payment_templates_updated_at before update on public.payment_templates
  for each row execute function public.set_updated_at();
create trigger trg_payment_requests_updated_at before update on public.payment_requests
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0001_phase2b_schema.sql
git commit -m "Add Phase 2B schema migration: 8 per-user tables, indexes, updated_at triggers"
```

(No `tsc`/`jest` gate for this task — it's pure SQL, not yet applied to any project.)

---

### Task 2: RLS migration SQL

**Files:**
- Create: `supabase/migrations/0002_phase2b_rls.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Phase 2B: row-level security. Every table: owner-only select/insert/update/delete.
-- profiles is keyed by id (= auth.users.id) directly; every other table by user_id.

alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.customers enable row level security;
alter table public.payment_templates enable row level security;
alter table public.payment_requests enable row level security;
alter table public.request_events enable row level security;
alter table public.transactions enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

create policy "business_profiles_select_own" on public.business_profiles for select using (auth.uid() = user_id);
create policy "business_profiles_insert_own" on public.business_profiles for insert with check (auth.uid() = user_id);
create policy "business_profiles_update_own" on public.business_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "business_profiles_delete_own" on public.business_profiles for delete using (auth.uid() = user_id);

create policy "wallets_select_own" on public.wallets for select using (auth.uid() = user_id);
create policy "wallets_insert_own" on public.wallets for insert with check (auth.uid() = user_id);
create policy "wallets_update_own" on public.wallets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wallets_delete_own" on public.wallets for delete using (auth.uid() = user_id);

create policy "customers_select_own" on public.customers for select using (auth.uid() = user_id);
create policy "customers_insert_own" on public.customers for insert with check (auth.uid() = user_id);
create policy "customers_update_own" on public.customers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "customers_delete_own" on public.customers for delete using (auth.uid() = user_id);

create policy "payment_templates_select_own" on public.payment_templates for select using (auth.uid() = user_id);
create policy "payment_templates_insert_own" on public.payment_templates for insert with check (auth.uid() = user_id);
create policy "payment_templates_update_own" on public.payment_templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payment_templates_delete_own" on public.payment_templates for delete using (auth.uid() = user_id);

create policy "payment_requests_select_own" on public.payment_requests for select using (auth.uid() = user_id);
create policy "payment_requests_insert_own" on public.payment_requests for insert with check (auth.uid() = user_id);
create policy "payment_requests_update_own" on public.payment_requests for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payment_requests_delete_own" on public.payment_requests for delete using (auth.uid() = user_id);

create policy "request_events_select_own" on public.request_events for select using (auth.uid() = user_id);
create policy "request_events_insert_own" on public.request_events for insert with check (auth.uid() = user_id);
create policy "request_events_update_own" on public.request_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "request_events_delete_own" on public.request_events for delete using (auth.uid() = user_id);

create policy "transactions_select_own" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0002_phase2b_rls.sql
git commit -m "Add Phase 2B RLS policies: owner-only access on every table"
```

---

### Task 3: Multi-write action functions

**Files:**
- Create: `supabase/migrations/0003_phase2b_functions.sql`

- [ ] **Step 1: Write the migration**

```sql
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
as $$
declare
  v_request public.payment_requests;
begin
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

create or replace function public.complete_payment(
  p_request_id uuid,
  p_should_fail boolean,
  p_tx_hash text
) returns public.transactions
language plpgsql
security invoker
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
    return null;
  end if;

  if p_should_fail then
    update public.payment_requests set status = 'pending' where id = p_request_id;
    insert into public.request_events (user_id, payment_request_id, event_type)
    values (auth.uid(), p_request_id, 'payment_failed');
    return null;
  end if;

  insert into public.transactions (user_id, payment_request_id, from_customer_id, amount, currency, network, tx_hash)
  values (auth.uid(), p_request_id, v_request.customer_id, v_request.amount, v_request.currency, v_request.network, p_tx_hash)
  returning * into v_transaction;

  update public.payment_requests set status = 'paid' where id = p_request_id;

  insert into public.request_events (user_id, payment_request_id, event_type)
  values (auth.uid(), p_request_id, 'payment_confirmed');

  return v_transaction;
end;
$$;

create or replace function public.cancel_payment_request(p_request_id uuid)
returns boolean
language plpgsql
security invoker
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0003_phase2b_functions.sql
git commit -m "Add Phase 2B RPC functions for the four multi-write request actions"
```

---

### Task 4: Data-lifecycle infrastructure + error copy util

**Files:**
- Create: `src/store/dataLifecycle.ts`
- Create: `src/utils/getDataErrorMessage.ts`
- Test: `src/utils/__tests__/getDataErrorMessage.test.ts`

This task creates the *shape* (`resetAllUserData` as a no-op placeholder, since the stores it will call don't exist yet) — later tasks fill in each store's `reset()` and wire it in.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/__tests__/getDataErrorMessage.test.ts
import { getDataErrorMessage } from '../getDataErrorMessage';

describe('getDataErrorMessage', () => {
  it('maps a generic failure to a calm, context-flavored message', () => {
    expect(getDataErrorMessage(new Error('relation "x" does not exist'), 'customers')).toBe(
      "We couldn't load your customers. Try again."
    );
  });

  it('maps save failures with save-flavored copy', () => {
    expect(getDataErrorMessage(new Error('constraint violation'), 'requests', 'save')).toBe(
      "We couldn't save this request. Try again."
    );
  });

  it('maps network errors distinctly regardless of context', () => {
    expect(getDataErrorMessage(new Error('Network request failed'), 'wallet')).toBe(
      "We couldn't connect right now. Check your internet connection and try again."
    );
  });

  it('never leaks the raw error message', () => {
    const message = getDataErrorMessage(new Error('duplicate key value violates unique constraint "payment_requests_payment_code_key"'), 'requests');
    expect(message).not.toContain('constraint');
    expect(message).not.toContain('payment_code');
  });

  it('handles non-Error values safely', () => {
    expect(getDataErrorMessage('a plain string', 'templates')).toBe("We couldn't load your templates. Try again.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/__tests__/getDataErrorMessage.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write the implementation**

```ts
// src/utils/getDataErrorMessage.ts
export type DataDomain = 'customers' | 'requests' | 'templates' | 'wallet' | 'profile';
export type DataAction = 'load' | 'save';

const DOMAIN_LABELS: Record<DataDomain, string> = {
  customers: 'your customers',
  requests: 'this request',
  templates: 'your templates',
  wallet: 'your wallet',
  profile: 'your profile',
};

// Never surfaces the raw Postgres/Supabase error to the UI — only a calm,
// domain- and action-flavored fallback. Mirrors authErrors.ts's established
// pattern for this codebase.
export function getDataErrorMessage(error: unknown, domain: DataDomain, action: DataAction = 'load'): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('timeout')) {
    return "We couldn't connect right now. Check your internet connection and try again.";
  }

  const label = DOMAIN_LABELS[domain];
  return action === 'save' ? `We couldn't save ${label}. Try again.` : `We couldn't load ${label}. Try again.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/__tests__/getDataErrorMessage.test.ts`
Expected: PASS

- [ ] **Step 5: Create the data-lifecycle module**

```ts
// src/store/dataLifecycle.ts

// The single place that clears every Supabase-backed store's cached data.
// Called on sign-out and defensively before loading a newly-signed-in user's
// data, so a moment of stale User-A state can never render while User-B's
// fetch is still in flight. Each store registers its own reset() here as it
// migrates — this file is intentionally the only place that knows about all
// of them, so nothing can be missed by scattering the call sites.
type ResetFn = () => void;

const resetters: ResetFn[] = [];

export function registerResettable(reset: ResetFn): void {
  resetters.push(reset);
}

export function resetAllUserData(): void {
  for (const reset of resetters) {
    reset();
  }
}
```

- [ ] **Step 6: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add src/store/dataLifecycle.ts src/utils/getDataErrorMessage.ts src/utils/__tests__/getDataErrorMessage.test.ts
git commit -m "Add data-lifecycle reset registry and calm error-copy util for Supabase-backed stores"
```

---

### Task 5: `buildPaymentRequest` — payment_link from payment_code, drop client-side id

**Files:**
- Modify: `src/utils/buildPaymentRequest.ts`
- Test: `src/utils/__tests__/buildPaymentRequest.test.ts`

- [ ] **Step 1: Read the current test file, understand its shape, then update it**

The current `buildPaymentRequest` returns a full `PaymentRequest` including a client-generated `id`. Post-migration, `id` is Postgres-generated (returned by the `create_payment_request` RPC), so this function's job narrows to producing the *insert payload* the RPC needs, not a full row. Rename its return type accordingly and update every assertion that referenced `.id` or `.paymentLink` using the old `https://pay.speropay.app/r/${id}` shape.

Read `src/utils/__tests__/buildPaymentRequest.test.ts` first to see its exact current assertions, then replace only the parts that reference `id`/the old `paymentLink` format — keep every other existing case (amount, description, customerId, expiryOption, expiresAt, note passthrough) intact, updating only what the shape change requires. Add:

```ts
it('builds paymentLink from paymentCode, not a client-generated id', () => {
  const payload = buildPaymentRequestPayload({ amount: 100, expiryOption: '7d' });
  expect(payload.paymentLink).toBe(`https://pay.speropay.app/r/${payload.paymentCode}`);
});
```

- [ ] **Step 2: Run tests to verify the updated ones fail**

Run: `npx jest src/utils/__tests__/buildPaymentRequest.test.ts`
Expected: FAIL — function still returns the old shape

- [ ] **Step 3: Write the implementation**

```ts
// src/utils/buildPaymentRequest.ts
import type { ExpiryOption } from '../types';
import { generatePaymentCode } from './ids';
import { calculateExpiresAt } from './expiry';

export interface CreateRequestInput {
  amount: number;
  description?: string;
  customerId?: string;
  expiryOption: ExpiryOption;
  note?: string;
}

// The insert payload for create_payment_request — everything the RPC needs
// that can be computed client-side before the row (and its Postgres-
// generated id) exists. paymentLink is derived from paymentCode (known
// up-front), not the row id (only known after insert) — see design doc 3.6.
export interface PaymentRequestPayload {
  paymentCode: string;
  paymentLink: string;
  amount: number;
  description?: string;
  customerId?: string;
  expiryOption: ExpiryOption;
  expiresAt: string | null;
  note?: string;
}

export function buildPaymentRequestPayload(input: CreateRequestInput, now: Date = new Date()): PaymentRequestPayload {
  const paymentCode = generatePaymentCode();

  return {
    paymentCode,
    paymentLink: `https://pay.speropay.app/r/${paymentCode}`,
    amount: input.amount,
    description: input.description,
    customerId: input.customerId,
    expiryOption: input.expiryOption,
    expiresAt: calculateExpiresAt(input.expiryOption, now),
    note: input.note,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/utils/__tests__/buildPaymentRequest.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `src/store/requestStore.ts` (still imports the old `buildPaymentRequest`/`CreateRequestInput` shape) and possibly `paymentSimulation.ts` if it imports `Transaction`'s old shape — **expected**, fixed in Task 11. Confirm the errors are limited to those files.

- [ ] **Step 6: Commit**

```bash
git add src/utils/buildPaymentRequest.ts src/utils/__tests__/buildPaymentRequest.test.ts
git commit -m "buildPaymentRequest: produce an RPC insert payload, derive paymentLink from paymentCode"
```

---

### Task 6: `profileStore` + business profile — Supabase-backed, single merged interface

**Files:**
- Modify: `src/store/profileStore.ts`
- Test: `src/store/__tests__/profileStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/store/__tests__/profileStore.test.ts
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '../../lib/supabase';
import { useProfileStore } from '../profileStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.insert = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.upsert = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useProfileStore.setState({ profile: null, status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('merges profiles + business_profiles rows into the flat Profile shape', async () => {
    const profilesBuilder = makeQueryBuilder({
      data: { id: 'user-1', display_name: 'Jane', country: 'UAE', usage_type: 'business', avatar_url: null, onboarding_completed: true },
      error: null,
    });
    const businessBuilder = makeQueryBuilder({
      data: { business_name: 'Jane LLC', business_email: 'jane@biz.com', website: 'https://jane.biz', description: 'desc', logo_url: null },
      error: null,
    });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'profiles' ? profilesBuilder : businessBuilder) as never
    );

    await useProfileStore.getState().loadForUser('user-1');

    const state = useProfileStore.getState();
    expect(state.status).toBe('loaded');
    expect(state.profile).toEqual({
      usageType: 'business',
      displayName: 'Jane',
      businessName: 'Jane LLC',
      country: 'UAE',
      website: 'https://jane.biz',
      avatarUri: undefined,
      businessEmail: 'jane@biz.com',
      businessDescription: 'desc',
      businessLogoUri: undefined,
      onboardingCompleted: true,
    });
  });

  it('creates a minimum valid profile if none exists yet, seeded from the auth full name', async () => {
    const profilesBuilder = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
    const insertedProfile = { id: 'user-2', display_name: 'New User', country: '', usage_type: null, avatar_url: null, onboarding_completed: false };
    profilesBuilder.single
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      .mockResolvedValueOnce({ data: insertedProfile, error: null });
    const businessBuilder = makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'profiles' ? profilesBuilder : businessBuilder) as never
    );

    await useProfileStore.getState().loadForUser('user-2', 'New User');

    expect(profilesBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-2', display_name: 'New User' })
    );
    expect(useProfileStore.getState().profile?.displayName).toBe('New User');
  });

  it('sets status to error with calm copy on failure, without leaking the raw error', async () => {
    const profilesBuilder = makeQueryBuilder({ data: null, error: new Error('relation missing') });
    mockedSupabase.from.mockReturnValue(profilesBuilder as never);

    await useProfileStore.getState().loadForUser('user-3');

    const state = useProfileStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe("We couldn't load your profile. Try again.");
  });
});

describe('reset', () => {
  it('clears profile back to idle', () => {
    useProfileStore.setState({ profile: { usageType: null, displayName: 'X', country: '', onboardingCompleted: false }, status: 'loaded', error: null });
    useProfileStore.getState().reset();
    const state = useProfileStore.getState();
    expect(state.profile).toBeNull();
    expect(state.status).toBe('idle');
  });
});

describe('updateProfile', () => {
  it('routes personal fields to profiles and business fields to business_profiles', async () => {
    useProfileStore.setState({
      profile: { usageType: 'business', displayName: 'Jane', country: 'UAE', onboardingCompleted: true },
      status: 'loaded',
      error: null,
    });
    const profilesBuilder = makeQueryBuilder({ data: {}, error: null });
    const businessBuilder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'profiles' ? profilesBuilder : businessBuilder) as never
    );

    await useProfileStore.getState().updateProfile('user-1', { displayName: 'Janet', businessName: 'Janet LLC' });

    expect(profilesBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Janet' }));
    expect(businessBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', business_name: 'Janet LLC' })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/__tests__/profileStore.test.ts`
Expected: FAIL — store doesn't have this shape yet

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/store/profileStore.ts`:

```ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Profile, UsageType } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface ProfileState {
  profile: Profile | null;
  status: Status;
  error: string | null;
  loadForUser: (userId: string, fallbackFullName?: string) => Promise<void>;
  updateProfile: (userId: string, patch: Partial<Omit<Profile, 'usageType' | 'onboardingCompleted'>>) => Promise<void>;
  setUsageType: (userId: string, usageType: UsageType) => Promise<void>;
  completeOnboarding: (userId: string) => Promise<void>;
  reset: () => void;
}

// Fields on the flat Profile object that live in `profiles` vs `business_profiles`.
const PERSONAL_FIELDS = new Set(['displayName', 'country', 'avatarUri']);

function mergeProfileRows(
  profileRow: {
    display_name: string;
    country: string;
    usage_type: string | null;
    avatar_url: string | null;
    onboarding_completed: boolean;
  },
  businessRow: {
    business_name: string | null;
    business_email: string | null;
    website: string | null;
    description: string | null;
    logo_url: string | null;
  } | null
): Profile {
  return {
    usageType: (profileRow.usage_type as UsageType | null) ?? null,
    displayName: profileRow.display_name,
    country: profileRow.country,
    avatarUri: profileRow.avatar_url ?? undefined,
    onboardingCompleted: profileRow.onboarding_completed,
    businessName: businessRow?.business_name ?? undefined,
    businessEmail: businessRow?.business_email ?? undefined,
    website: businessRow?.website ?? undefined,
    businessDescription: businessRow?.description ?? undefined,
    businessLogoUri: businessRow?.logo_url ?? undefined,
  };
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  profile: null,
  status: 'idle',
  error: null,

  loadForUser: async (userId, fallbackFullName) => {
    set({ status: 'loading', error: null });
    try {
      let { data: profileRow } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!profileRow) {
        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, display_name: fallbackFullName ?? '' })
          .select('*')
          .single();
        if (insertError) throw insertError;
        profileRow = created;
      }

      const { data: businessRow } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      set({ profile: mergeProfileRows(profileRow, businessRow ?? null), status: 'loaded' });
    } catch (error) {
      set({ status: 'error', error: getDataErrorMessage(error, 'profile') });
    }
  },

  updateProfile: async (userId, patch) => {
    const personalPatch: Record<string, unknown> = {};
    const businessPatch: Record<string, unknown> = {};

    if ('displayName' in patch) personalPatch.display_name = patch.displayName;
    if ('country' in patch) personalPatch.country = patch.country;
    if ('avatarUri' in patch) personalPatch.avatar_url = patch.avatarUri ?? null;
    if ('businessName' in patch) businessPatch.business_name = patch.businessName ?? null;
    if ('businessEmail' in patch) businessPatch.business_email = patch.businessEmail ?? null;
    if ('website' in patch) businessPatch.website = patch.website ?? null;
    if ('businessDescription' in patch) businessPatch.description = patch.businessDescription ?? null;
    if ('businessLogoUri' in patch) businessPatch.logo_url = patch.businessLogoUri ?? null;

    try {
      if (Object.keys(personalPatch).length > 0) {
        const { error } = await supabase.from('profiles').update(personalPatch).eq('id', userId);
        if (error) throw error;
      }
      if (Object.keys(businessPatch).length > 0) {
        const { error } = await supabase
          .from('business_profiles')
          .upsert({ user_id: userId, ...businessPatch }, { onConflict: 'user_id' });
        if (error) throw error;
      }

      const current = get().profile;
      if (current) {
        set({ profile: { ...current, ...patch } });
      }
    } catch (error) {
      set({ error: getDataErrorMessage(error, 'profile', 'save') });
      throw error;
    }
  },

  setUsageType: async (userId, usageType) => {
    const { error } = await supabase.from('profiles').update({ usage_type: usageType }).eq('id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'profile', 'save') });
      throw error;
    }
    const current = get().profile;
    if (current) set({ profile: { ...current, usageType } });
  },

  completeOnboarding: async (userId) => {
    const { error } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'profile', 'save') });
      throw error;
    }
    const current = get().profile;
    if (current) set({ profile: { ...current, onboardingCompleted: true } });
  },

  reset: () => set({ profile: null, status: 'idle', error: null }),
}));

registerResettable(() => useProfileStore.getState().reset());
```

Add `onboardingCompleted: boolean` to the `Profile` type in `src/types/user.ts`:

```ts
export interface Profile {
  usageType: UsageType | null;
  displayName: string;
  businessName?: string;
  country: string;
  website?: string;
  avatarUri?: string;
  businessEmail?: string;
  businessDescription?: string;
  businessLogoUri?: string;
  onboardingCompleted: boolean;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/store/__tests__/profileStore.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in every screen still calling the old `profileStore` shape (`updateProfile` with no `userId` arg, `setUsageType` with no `userId` arg) and in `onboardingStore.ts`/`authRouting.ts`/`AuthGate.tsx`/`app/index.tsx` (still reference the old per-user-array onboarding hook) — **expected**, fixed in Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/store/profileStore.ts src/store/__tests__/profileStore.test.ts src/types/user.ts
git commit -m "Rewrite profileStore as Supabase-backed, merging profiles + business_profiles"
```

---

### Task 7: `walletStore` — Supabase-backed

**Files:**
- Modify: `src/store/walletStore.ts`
- Test: `src/store/__tests__/walletStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/store/__tests__/walletStore.test.ts
jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useWalletStore } from '../walletStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.upsert = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useWalletStore.setState({ wallet: null, status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads the default wallet for the user', async () => {
    const builder = makeQueryBuilder({
      data: { network: 'Solana', stablecoin: 'USDC', address: '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu' },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useWalletStore.getState().loadForUser('user-1');

    expect(useWalletStore.getState().wallet).toEqual({
      network: 'Solana',
      stablecoin: 'USDC',
      address: '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu',
    });
    expect(useWalletStore.getState().status).toBe('loaded');
  });

  it('leaves wallet null when the user has none yet', async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useWalletStore.getState().loadForUser('user-1');

    expect(useWalletStore.getState().wallet).toBeNull();
    expect(useWalletStore.getState().status).toBe('loaded');
  });
});

describe('setWalletAddress', () => {
  it('upserts on user_id so V1 stays single-wallet-per-user', async () => {
    const builder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useWalletStore.getState().setWalletAddress('user-1', 'NewAddress111111111111111111111111111');

    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        address: 'NewAddress111111111111111111111111111',
        network: 'Solana',
        stablecoin: 'USDC',
        is_default: true,
      }),
      { onConflict: 'user_id' }
    );
    expect(useWalletStore.getState().wallet?.address).toBe('NewAddress111111111111111111111111111');
  });
});

describe('reset', () => {
  it('clears wallet back to idle', () => {
    useWalletStore.setState({ wallet: { network: 'Solana', stablecoin: 'USDC', address: 'x' }, status: 'loaded', error: null });
    useWalletStore.getState().reset();
    expect(useWalletStore.getState().wallet).toBeNull();
    expect(useWalletStore.getState().status).toBe('idle');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/__tests__/walletStore.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

Note: for the `upsert(..., { onConflict: 'user_id' })` pattern to work as a true single-row-per-user upsert, add a unique constraint on `wallets.user_id` for V1 (the schema in Task 1 deliberately left this open per the design doc's "flexible for future multi-wallet" reasoning — add the constraint here instead, scoped to *this task*, since it's what makes single-wallet-per-user upsert atomic rather than "usually one row by convention"):

Add to `supabase/migrations/0001_phase2b_schema.sql` (amend before it's ever run against a real project — this plan is being executed before any migration has been applied):

```sql
alter table public.wallets add constraint wallets_user_id_key unique (user_id);
```

(Append this line to the end of Task 1's file rather than editing it as a new migration — Task 1 hasn't been applied to any live project yet at this point in plan execution.)

Replace the full contents of `src/store/walletStore.ts`:

```ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Wallet } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface WalletState {
  wallet: Wallet | null;
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  setWalletAddress: (userId: string, address: string) => Promise<void>;
  reset: () => void;
}

export const useWalletStore = create<WalletState>()((set) => ({
  wallet: null,
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('network, stablecoin, address')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      set({ wallet: data ? { network: data.network, stablecoin: data.stablecoin, address: data.address } : null, status: 'loaded' });
    } catch (error) {
      set({ status: 'error', error: getDataErrorMessage(error, 'wallet') });
    }
  },

  setWalletAddress: async (userId, address) => {
    const wallet: Wallet = { stablecoin: 'USDC', network: 'Solana', address };
    try {
      const { error } = await supabase
        .from('wallets')
        .upsert(
          { user_id: userId, address, network: 'Solana', stablecoin: 'USDC', is_default: true },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
      set({ wallet });
    } catch (error) {
      set({ error: getDataErrorMessage(error, 'wallet', 'save') });
      throw error;
    }
  },

  reset: () => set({ wallet: null, status: 'idle', error: null }),
}));

registerResettable(() => useWalletStore.getState().reset());
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/store/__tests__/walletStore.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `(onboarding)/wallet-setup.tsx`, `(app)/profile/wallet.tsx` (old 1-arg `setWalletAddress` call) — **expected**, fixed in Task 8/screens pass.

- [ ] **Step 6: Commit**

```bash
git add src/store/walletStore.ts src/store/__tests__/walletStore.test.ts supabase/migrations/0001_phase2b_schema.sql
git commit -m "Rewrite walletStore as Supabase-backed, single wallet per user via upsert"
```

---

### Task 8: Onboarding completion moves to `profiles.onboarding_completed`; remove `onboardingStore`; wire the bootstrap/reset effect

**Files:**
- Delete: `src/store/onboardingStore.ts`, `src/store/__tests__/onboardingStore.test.ts`
- Modify: `src/utils/authRouting.ts` (no change needed — already takes `hasCompletedOnboarding: boolean`, source just changes)
- Modify: `src/components/AuthGate.tsx`, `app/index.tsx`, `app/auth/callback.tsx`, `app/(auth)/reset-password.tsx`
- Modify: `app/_layout.tsx` — add the bootstrap/reset effect
- Modify: `app/(onboarding)/usage-type.tsx`, `app/(onboarding)/profile.tsx`, `app/(onboarding)/wallet-setup.tsx`

- [ ] **Step 1: Delete `onboardingStore` and its test**

```bash
git rm src/store/onboardingStore.ts src/store/__tests__/onboardingStore.test.ts
```

- [ ] **Step 2: Add the bootstrap/reset effect to `app/_layout.tsx`**

Add imports:

```ts
import { useRef } from 'react';
import { useAuthStore } from '../src/store/authStore';
import { useProfileStore } from '../src/store/profileStore';
import { useWalletStore } from '../src/store/walletStore';
import { resetAllUserData } from '../src/store/dataLifecycle';
```

Add, inside `RootLayout`, alongside the existing `initializeAuthListener` effect:

```ts
  const userId = useAuthStore((state) => state.user?.id);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const fullName = useAuthStore((state) => state.user?.fullName);
  const lastLoadedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!authHasHydrated) return;

    if (!userId) {
      if (lastLoadedUserId.current !== null) {
        resetAllUserData();
        lastLoadedUserId.current = null;
      }
      return;
    }

    if (lastLoadedUserId.current === userId) return;
    resetAllUserData();
    lastLoadedUserId.current = userId;
    useProfileStore.getState().loadForUser(userId, fullName);
    useWalletStore.getState().loadForUser(userId);
  }, [authHasHydrated, userId, fullName]);
```

(Task 9-11 add each remaining domain store's `loadForUser(userId)` call to this same effect as they're built — noted again in each of those tasks so this block isn't forgotten.)

- [ ] **Step 3: Update `AuthGate.tsx`**

Replace the full contents of `src/components/AuthGate.tsx`:

```tsx
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { resolveAuthGateRedirect, type AuthGateMode } from '../utils/authRouting';

interface AuthGateProps {
  mode: AuthGateMode;
  children: React.ReactNode;
}

export function AuthGate({ mode, children }: AuthGateProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);
  const profileStatus = useProfileStore((state) => state.status);
  const hasCompletedOnboarding = useProfileStore((state) => state.profile?.onboardingCompleted ?? false);

  // Both the auth session and the profile fetch must settle before a
  // redirect decision can be trusted — the profile fetch is now a network
  // call (Phase 2B), not local storage rehydration, so this gate can be
  // "loading" for longer than it used to. Deciding on the default
  // (hasCompletedOnboarding: false) before it resolves would send an
  // already-onboarded user into onboarding, where re-entering the business
  // profile overwrites real data.
  if (!authHasHydrated) return null;
  if (isAuthenticated && (profileStatus === 'idle' || profileStatus === 'loading')) return null;

  const redirectTo = resolveAuthGateRedirect(mode, { isAuthenticated, hasCompletedOnboarding, isPasswordRecovery });
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Update `app/index.tsx`**

Change the onboarding-related imports/selectors from `useHasCompletedOnboarding()`/`useOnboardingStore` to:

```ts
import { useProfileStore } from '../src/store/profileStore';
```

```ts
  const profileStatus = useProfileStore((state) => state.status);
  const hasCompletedOnboarding = useProfileStore((state) => state.profile?.onboardingCompleted ?? false);
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);
```

Change the hydration gate:

```ts
  const storesHydrated = authHasHydrated && (!isAuthenticated || (profileStatus !== 'idle' && profileStatus !== 'loading'));
```

(Unauthenticated visitors don't wait on a profile fetch that will never happen — only an authenticated session needs to wait for `profileStore` to settle.)

Rest of the effect/redirect call is unchanged (`resolveInitialRoute({ isAuthenticated, hasCompletedOnboarding, isPasswordRecovery })`).

- [ ] **Step 5: Update `app/auth/callback.tsx` and `app/(auth)/reset-password.tsx`**

Both currently call `useHasCompletedOnboarding()` from the now-deleted `onboardingStore`. Replace with:

```ts
const hasCompletedOnboarding = useProfileStore((state) => state.profile?.onboardingCompleted ?? false);
```

(add `import { useProfileStore } from '../../src/store/profileStore';` to each; remove the old `useHasCompletedOnboarding` import).

- [ ] **Step 6: Update onboarding screens**

`app/(onboarding)/usage-type.tsx` — change:
```ts
const setUsageType = useProfileStore((state) => state.setUsageType);
```
to:
```ts
const setUsageType = useProfileStore((state) => state.setUsageType);
const userId = useAuthStore((state) => state.user?.id);
```
(add `import { useAuthStore } from '../../src/store/authStore';`), and change the call site from `setUsageType(selected)` to `if (userId) await setUsageType(userId, selected);` (the screen's handler becomes `async`).

`app/(onboarding)/profile.tsx` — change the `updateProfile` call site from `updateProfile({...})` to `await updateProfile(userId, {...})`, adding `const userId = useAuthStore((state) => state.user?.id);` (import `useAuthStore`) and guarding `if (!userId) return;` before the call; handler becomes `async`.

`app/(onboarding)/wallet-setup.tsx` — change:
```ts
setWalletAddress(address.trim());
completeOnboarding(userId);
```
to:
```ts
await setWalletAddress(userId, address.trim());
await useProfileStore.getState().completeOnboarding(userId);
```
(remove the old `useOnboardingStore` import/selector entirely; `handleComplete` becomes `async`; add `import { useProfileStore } from '../../src/store/profileStore';`). Wrap in try/catch — on failure, show a calm inline error (matching this screen's existing `setError` pattern) instead of silently completing onboarding on a failed save, per the phase brief's explicit "do not mark onboarding complete before required data is successfully stored":

```ts
async function handleComplete() {
  if (!isValidWalletAddress(address.trim())) {
    setError('Enter a valid Solana wallet address');
    return;
  }
  if (!userId) return;
  try {
    await setWalletAddress(userId, address.trim());
    await useProfileStore.getState().completeOnboarding(userId);
    router.replace('/(app)/home');
  } catch {
    setError("We couldn't finish setup. Check your connection and try again.");
  }
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, or errors only in domain stores/screens not yet migrated (customers/requests/templates/transactions — Tasks 9-11).

- [ ] **Step 8: Full suite + commit**

```bash
npx jest
git add -A
git commit -m "Move onboarding completion to profiles.onboarding_completed; remove onboardingStore; wire user-change data bootstrap/reset"
```

---

### Task 9: `customerStore` — Supabase-backed + customers screens loading/error states

**Files:**
- Modify: `src/store/customerStore.ts`
- Modify: `app/(app)/customers/index.tsx`, `app/(app)/customers/[id].tsx`
- Modify: `app/_layout.tsx` (add `useCustomerStore.getState().loadForUser(userId)` to the bootstrap effect from Task 8 Step 2)
- Test: `src/store/__tests__/customerStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/store/__tests__/customerStore.test.ts
jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useCustomerStore } from '../customerStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.insert = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useCustomerStore.setState({ customers: [], status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads and maps rows to the Customer shape', async () => {
    const builder = makeQueryBuilder({
      data: [{ id: 'c1', name: 'Jane', email: 'jane@x.com', avatar_color: 'blue', company: null, notes: null }],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useCustomerStore.getState().loadForUser('user-1');

    expect(useCustomerStore.getState().customers).toEqual([
      { id: 'c1', name: 'Jane', email: 'jane@x.com', avatarColor: 'blue', company: undefined, notes: undefined },
    ]);
    expect(useCustomerStore.getState().status).toBe('loaded');
  });

  it('sets a calm error on failure', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('boom') });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useCustomerStore.getState().loadForUser('user-1');

    expect(useCustomerStore.getState().status).toBe('error');
    expect(useCustomerStore.getState().error).toBe("We couldn't load your customers. Try again.");
  });
});

describe('addCustomer', () => {
  it('inserts scoped to the user and cycles avatar colors by current count', async () => {
    useCustomerStore.setState({ customers: [{ id: 'a', name: 'A', email: 'a@x.com', avatarColor: 'mint' }], status: 'loaded', error: null });
    const builder = makeQueryBuilder({
      data: { id: 'c2', name: 'Bob', email: 'bob@x.com', avatar_color: 'lavender', company: null, notes: null },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    const result = await useCustomerStore.getState().addCustomer('user-1', { name: 'Bob', email: 'bob@x.com' });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', name: 'Bob', email: 'bob@x.com', avatar_color: 'lavender' })
    );
    expect(result.id).toBe('c2');
    expect(useCustomerStore.getState().customers).toHaveLength(2);
  });
});

describe('reset', () => {
  it('clears customers back to idle', () => {
    useCustomerStore.setState({ customers: [{ id: 'a', name: 'A', email: 'a@x.com', avatarColor: 'mint' }], status: 'loaded', error: null });
    useCustomerStore.getState().reset();
    expect(useCustomerStore.getState().customers).toEqual([]);
    expect(useCustomerStore.getState().status).toBe('idle');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/__tests__/customerStore.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/store/customerStore.ts`:

```ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Customer } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

export interface AddCustomerInput {
  name: string;
  email: string;
  company?: string;
  notes?: string;
}

interface CustomerState {
  customers: Customer[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  addCustomer: (userId: string, input: AddCustomerInput) => Promise<Customer>;
  updateCustomer: (userId: string, id: string, patch: Partial<Omit<Customer, 'id'>>) => Promise<void>;
  getCustomerById: (id: string) => Customer | undefined;
  reset: () => void;
}

const AVATAR_COLORS: Customer['avatarColor'][] = ['mint', 'lavender', 'blue', 'red'];

function mapRow(row: {
  id: string;
  name: string;
  email: string;
  avatar_color: Customer['avatarColor'];
  company: string | null;
  notes: string | null;
}): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarColor: row.avatar_color,
    company: row.company ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export const useCustomerStore = create<CustomerState>()((set, get) => ({
  customers: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ customers: (data ?? []).map(mapRow), status: 'loaded' });
    } catch (error) {
      set({ status: 'error', error: getDataErrorMessage(error, 'customers') });
    }
  },

  addCustomer: async (userId, input) => {
    const avatarColor = AVATAR_COLORS[get().customers.length % AVATAR_COLORS.length];
    const { data, error } = await supabase
      .from('customers')
      .insert({
        user_id: userId,
        name: input.name,
        email: input.email,
        company: input.company ?? null,
        notes: input.notes ?? null,
        avatar_color: avatarColor,
      })
      .select('*')
      .single();
    if (error) {
      set({ error: getDataErrorMessage(error, 'customers', 'save') });
      throw error;
    }
    const customer = mapRow(data);
    set((state) => ({ customers: [customer, ...state.customers] }));
    return customer;
  },

  updateCustomer: async (userId, id, patch) => {
    const dbPatch: Record<string, unknown> = {};
    if ('name' in patch) dbPatch.name = patch.name;
    if ('email' in patch) dbPatch.email = patch.email;
    if ('company' in patch) dbPatch.company = patch.company ?? null;
    if ('notes' in patch) dbPatch.notes = patch.notes ?? null;

    const { error } = await supabase.from('customers').update(dbPatch).eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'customers', 'save') });
      throw error;
    }
    set((state) => ({ customers: state.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  },

  getCustomerById: (id) => get().customers.find((c) => c.id === id),

  reset: () => set({ customers: [], status: 'idle', error: null }),
}));

registerResettable(() => useCustomerStore.getState().reset());
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/store/__tests__/customerStore.test.ts`
Expected: PASS

- [ ] **Step 5: Add `useCustomerStore.getState().loadForUser(userId)` to the `app/_layout.tsx` bootstrap effect** (Task 8 Step 2's block), alongside the profile/wallet loads.

- [ ] **Step 6: Update `customers/index.tsx`**

Change `addCustomer({...})` to `await addCustomer(userId, {...})`, add `const userId = useAuthStore((state) => state.user?.id);` (import `useAuthStore`), guard `if (!userId) return;` in `handleAdd` (now `async`). Add a loading/error state to the `FlatList`'s `ListEmptyComponent`:

```tsx
const status = useCustomerStore((state) => state.status);
const error = useCustomerStore((state) => state.error);
```

```tsx
ListEmptyComponent={
  status === 'loading' ? (
    <ActivityIndicator color={colors.primaryAction} style={{ marginTop: spacing.xl }} />
  ) : status === 'error' ? (
    <EmptyState icon="alert-circle-outline" title="Couldn't load customers" description={error ?? undefined} />
  ) : (
    <EmptyState
      icon="people-outline"
      title={query.length > 0 ? 'No matching customers' : 'No customers yet'}
      description={query.length > 0 ? 'Try a different search term.' : 'Add a customer to start requesting payments from them.'}
    />
  )
}
```
(add `ActivityIndicator` to the `react-native` import.)

- [ ] **Step 7: Update `customers/[id].tsx`**

Change `updateCustomer(customerId, {...})` to `await updateCustomer(userId, customerId, {...})` (add `const userId = useAuthStore((state) => state.user?.id);`, guard, `handleSaveEdit` becomes `async`). No loading-state UI needed here beyond the existing `if (!customer) return <...AppHeader-only fallback>` (already acts as a reasonable "not loaded yet / not found" state, matching the file's current pattern — do not add new UI beyond what's needed).

- [ ] **Step 8: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add -A
git commit -m "Migrate customers to Supabase; add loading/error states to the customers list"
```

---

### Task 10: `templateStore` — Supabase-backed + templates screen

**Files:**
- Modify: `src/store/templateStore.ts`
- Modify: `app/(app)/profile/templates.tsx`
- Modify: `app/_layout.tsx` (add `useTemplateStore.getState().loadForUser(userId)` to the bootstrap effect)
- Test: `src/store/__tests__/templateStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/store/__tests__/templateStore.test.ts
jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useTemplateStore } from '../templateStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.insert = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.delete = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useTemplateStore.setState({ templates: [], status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads and maps rows', async () => {
    const builder = makeQueryBuilder({
      data: [{ id: 't1', name: 'Website', amount: '1000', description: null, expiry_option: '7d' }],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().loadForUser('user-1');

    expect(useTemplateStore.getState().templates).toEqual([
      { id: 't1', name: 'Website', amount: 1000, description: undefined, expiryOption: '7d' },
    ]);
  });
});

describe('addTemplate / updateTemplate / deleteTemplate', () => {
  it('addTemplate inserts scoped to user', async () => {
    const builder = makeQueryBuilder({
      data: { id: 't2', name: 'SEO', amount: '500', description: null, expiry_option: '7d' },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    const result = await useTemplateStore
      .getState()
      .addTemplate('user-1', { name: 'SEO', amount: 500, expiryOption: '7d' });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', name: 'SEO', amount: 500 }));
    expect(result.id).toBe('t2');
  });

  it('updateTemplate keeps the (userId, id, patch) call signature', async () => {
    useTemplateStore.setState({ templates: [{ id: 't1', name: 'A', amount: 1, expiryOption: '7d' }], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().updateTemplate('user-1', 't1', { name: 'B' });

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'B' }));
    expect(useTemplateStore.getState().templates[0].name).toBe('B');
  });

  it('deleteTemplate removes locally after a successful delete', async () => {
    useTemplateStore.setState({ templates: [{ id: 't1', name: 'A', amount: 1, expiryOption: '7d' }], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().deleteTemplate('user-1', 't1');

    expect(useTemplateStore.getState().templates).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/__tests__/templateStore.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

```ts
// src/store/templateStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Template } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface TemplateState {
  templates: Template[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  addTemplate: (userId: string, input: Omit<Template, 'id'>) => Promise<Template>;
  updateTemplate: (userId: string, id: string, patch: Partial<Omit<Template, 'id'>>) => Promise<void>;
  deleteTemplate: (userId: string, id: string) => Promise<void>;
  reset: () => void;
}

function mapRow(row: { id: string; name: string; amount: string | number; description: string | null; expiry_option: Template['expiryOption'] }): Template {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    description: row.description ?? undefined,
    expiryOption: row.expiry_option,
  };
}

export const useTemplateStore = create<TemplateState>()((set) => ({
  templates: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('payment_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ templates: (data ?? []).map(mapRow), status: 'loaded' });
    } catch (error) {
      set({ status: 'error', error: getDataErrorMessage(error, 'templates') });
    }
  },

  addTemplate: async (userId, input) => {
    const { data, error } = await supabase
      .from('payment_templates')
      .insert({
        user_id: userId,
        name: input.name,
        amount: input.amount,
        description: input.description ?? null,
        expiry_option: input.expiryOption,
      })
      .select('*')
      .single();
    if (error) {
      set({ error: getDataErrorMessage(error, 'templates', 'save') });
      throw error;
    }
    const template = mapRow(data);
    set((state) => ({ templates: [template, ...state.templates] }));
    return template;
  },

  updateTemplate: async (userId, id, patch) => {
    const dbPatch: Record<string, unknown> = {};
    if ('name' in patch) dbPatch.name = patch.name;
    if ('amount' in patch) dbPatch.amount = patch.amount;
    if ('description' in patch) dbPatch.description = patch.description ?? null;
    if ('expiryOption' in patch) dbPatch.expiry_option = patch.expiryOption;

    const { error } = await supabase.from('payment_templates').update(dbPatch).eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'templates', 'save') });
      throw error;
    }
    set((state) => ({ templates: state.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },

  deleteTemplate: async (userId, id) => {
    const { error } = await supabase.from('payment_templates').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'templates', 'save') });
      throw error;
    }
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
  },

  reset: () => set({ templates: [], status: 'idle', error: null }),
}));

registerResettable(() => useTemplateStore.getState().reset());
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/store/__tests__/templateStore.test.ts`
Expected: PASS

- [ ] **Step 5: Add `useTemplateStore.getState().loadForUser(userId)` to the `app/_layout.tsx` bootstrap effect.**

- [ ] **Step 6: Update `profile/templates.tsx`**

Update call sites to the new signatures: `addTemplate(userId, input)`, `updateTemplate(userId, editingId, input)`, `deleteTemplate(userId, id)` — add `const userId = useAuthStore((state) => state.user?.id);` (import `useAuthStore`), guard each handler with `if (!userId) return;`, make handlers `async`. Add a loading state for the initial list render (same `ActivityIndicator`-while-`status==='loading'` pattern as Task 9's customers list) if the screen renders a list/empty-state for zero templates — match whatever empty-state component this screen already uses.

- [ ] **Step 7: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add -A
git commit -m "Migrate payment templates to Supabase"
```

---

### Task 11: `requestStore` + `requestEventStore` + `transactionStore` — RPC-backed, single consolidated task

These three are migrated together because `requestStore`'s multi-write actions (`createRequest`, `beginPaymentConfirmation`, `completePayment`, `cancelRequest`) now call the Task 3 RPC functions directly instead of `useRequestEventStore.getState()`/`useTransactionStore.getState()` — `requestEventStore` and `transactionStore` become pure read-only caches, populated by `loadForUser` and by the return values of `requestStore`'s RPC calls.

**Files:**
- Modify: `src/store/requestStore.ts`, `src/store/requestEventStore.ts`, `src/store/transactionStore.ts`
- Modify: `src/utils/paymentSimulation.ts` (adjust `Transaction`-shaped return type only if needed — logic unchanged)
- Modify: `app/(app)/requests/index.tsx`, `app/(app)/requests/[id].tsx`, `app/(app)/customers/[id].tsx` (already updated Task 9 for customer bits; this task's changes are additive), `app/request/details.tsx`, `app/request/created.tsx`
- Modify: `app/_layout.tsx` (add `loadForUser` calls for all three stores)
- Test: `src/store/__tests__/requestStore.test.ts`, `src/store/__tests__/requestEventStore.test.ts`, `src/store/__tests__/transactionStore.test.ts`

- [ ] **Step 1: Write the failing tests for `requestStore`**

```ts
// src/store/__tests__/requestStore.test.ts
jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useRequestStore } from '../requestStore';
import { useRequestEventStore } from '../requestEventStore';
import { useTransactionStore } from '../transactionStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.delete = jest.fn(chain);
  builder.eq = jest.fn(() => Promise.resolve(result));
  builder.order = jest.fn(() => Promise.resolve(result));
  return builder;
}

function mapRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    customer_id: 'c1',
    wallet_id: null,
    payment_code: 'SP-AAAAA',
    amount: '100',
    currency: 'USDC',
    network: 'Solana',
    description: null,
    note: null,
    expiry_option: '7d',
    expires_at: null,
    status: 'pending',
    payment_link: 'https://pay.speropay.app/r/SP-AAAAA',
    created_at: '2026-08-21T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useRequestStore.setState({ requests: [], isCreating: false, status: 'idle', error: null });
  useRequestEventStore.setState({ events: [], status: 'idle', error: null });
  useTransactionStore.setState({ transactions: [], status: 'idle', error: null });
});

describe('createRequest', () => {
  it('calls the create_payment_request RPC and prepends the mapped result', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: mapRequestRow(), error: null } as never);

    const request = await useRequestStore.getState().createRequest('user-1', {
      amount: 100,
      customerId: 'c1',
      expiryOption: '7d',
    });

    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      'create_payment_request',
      expect.objectContaining({ p_amount: 100, p_customer_id: 'c1', p_expiry_option: '7d' })
    );
    expect(request.id).toBe('r1');
    expect(request.paymentCode).toBe('SP-AAAAA');
    expect(useRequestStore.getState().requests).toHaveLength(1);
  });
});

describe('beginPaymentConfirmation / completePayment', () => {
  it('begin calls the RPC and returns its boolean result', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: true, error: null } as never);
    useRequestStore.setState({ requests: [mapPaymentRequestForStore('r1', 'pending')], isCreating: false, status: 'loaded', error: null });

    const result = await useRequestStore.getState().beginPaymentConfirmation('user-1', 'r1');

    expect(result).toBe(true);
    expect(mockedSupabase.rpc).toHaveBeenCalledWith('begin_payment_confirmation', { p_request_id: 'r1' });
    expect(useRequestStore.getState().requests[0].status).toBe('confirming');
  });

  it('completePayment on success updates status to paid and caches the transaction', async () => {
    useRequestStore.setState({ requests: [mapPaymentRequestForStore('r1', 'confirming')], isCreating: false, status: 'loaded', error: null });
    mockedSupabase.rpc.mockResolvedValue({
      data: { id: 'tx1', payment_request_id: 'r1', from_customer_id: 'c1', amount: '100', currency: 'USDC', network: 'Solana', tx_hash: 'HASH', paid_at: '2026-08-21T00:00:00.000Z' },
      error: null,
    } as never);

    const transaction = await useRequestStore.getState().completePayment('user-1', 'r1', { forceFailure: false });

    expect(transaction?.id).toBe('tx1');
    expect(useRequestStore.getState().requests[0].status).toBe('paid');
    expect(useTransactionStore.getState().transactions).toHaveLength(1);
  });

  it('completePayment on forced failure reverts status to pending and returns null', async () => {
    useRequestStore.setState({ requests: [mapPaymentRequestForStore('r1', 'confirming')], isCreating: false, status: 'loaded', error: null });
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

    const transaction = await useRequestStore.getState().completePayment('user-1', 'r1', { forceFailure: true });

    expect(transaction).toBeNull();
    expect(useRequestStore.getState().requests[0].status).toBe('pending');
  });
});

function mapPaymentRequestForStore(id: string, status: string) {
  return {
    id,
    paymentCode: 'SP-AAAAA',
    amount: 100,
    currency: 'USDC' as const,
    network: 'Solana' as const,
    customerId: 'c1',
    expiryOption: '7d' as const,
    expiresAt: null,
    status: status as never,
    createdAt: '2026-08-21T00:00:00.000Z',
    paymentLink: 'https://pay.speropay.app/r/SP-AAAAA',
  };
}

describe('reset', () => {
  it('clears requests back to idle', () => {
    useRequestStore.setState({ requests: [mapPaymentRequestForStore('r1', 'pending')], isCreating: false, status: 'loaded', error: null });
    useRequestStore.getState().reset();
    expect(useRequestStore.getState().requests).toEqual([]);
    expect(useRequestStore.getState().status).toBe('idle');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/__tests__/requestStore.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `requestEventStore.ts` and `transactionStore.ts` first (requestStore depends on their mapping shape)**

```ts
// src/store/requestEventStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { RequestEvent, RequestEventType } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface RequestEventState {
  events: RequestEvent[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  getEventsForRequest: (requestId: string) => RequestEvent[];
  addLocal: (event: RequestEvent) => void;
  reset: () => void;
}

function mapRow(row: { id: string; payment_request_id: string; event_type: RequestEventType; occurred_at: string }): RequestEvent {
  return { id: row.id, requestId: row.payment_request_id, type: row.event_type, occurredAt: row.occurred_at };
}

export const useRequestEventStore = create<RequestEventState>()((set, get) => ({
  events: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('request_events')
        .select('*')
        .eq('user_id', userId)
        .order('occurred_at', { ascending: true });
      if (error) throw error;
      set({ events: (data ?? []).map(mapRow), status: 'loaded' });
    } catch (error) {
      set({ status: 'error', error: getDataErrorMessage(error, 'requests') });
    }
  },

  getEventsForRequest: (requestId) =>
    get()
      .events.filter((e) => e.requestId === requestId)
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),

  // Events are written server-side only, inside the RPC functions
  // (create_payment_request etc.) — this just merges the resulting row into
  // the local cache after a successful RPC call, it never inserts directly.
  addLocal: (event) => set((state) => ({ events: [...state.events, event] })),

  reset: () => set({ events: [], status: 'idle', error: null }),
}));

registerResettable(() => useRequestEventStore.getState().reset());
```

```ts
// src/store/transactionStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Transaction } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface TransactionState {
  transactions: Transaction[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  getTransactionForRequest: (requestId: string) => Transaction | undefined;
  addLocal: (transaction: Transaction) => void;
  reset: () => void;
}

function mapRow(row: {
  id: string;
  payment_request_id: string;
  from_customer_id: string | null;
  amount: string | number;
  currency: Transaction['currency'];
  network: Transaction['network'];
  tx_hash: string;
  paid_at: string;
}): Transaction {
  return {
    id: row.id,
    requestId: row.payment_request_id,
    amount: Number(row.amount),
    currency: row.currency,
    network: row.network,
    fromCustomerId: row.from_customer_id ?? '',
    txHash: row.tx_hash,
    paidAt: row.paid_at,
  };
}

export const useTransactionStore = create<TransactionState>()((set, get) => ({
  transactions: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      set({ transactions: (data ?? []).map(mapRow), status: 'loaded' });
    } catch (error) {
      set({ status: 'error', error: getDataErrorMessage(error, 'requests') });
    }
  },

  getTransactionForRequest: (requestId) => get().transactions.find((t) => t.requestId === requestId),

  // Written server-side only (inside complete_payment) — this merges the
  // RPC's returned row into the local cache, it never inserts directly.
  addLocal: (transaction) => set((state) => ({ transactions: [transaction, ...state.transactions] })),

  reset: () => set({ transactions: [], status: 'idle', error: null }),
}));

registerResettable(() => useTransactionStore.getState().reset());
```

Export the row-mapping function from `transactionStore.ts` isn't needed elsewhere — `requestStore.ts` will map the RPC's returned transaction row itself using the same shape, to avoid a cross-module private-function import; keep the two mappings in sync by eye (both map the same `transactions` row shape).

- [ ] **Step 4: Write `requestStore.ts`**

```ts
// src/store/requestStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { PaymentRequest, Transaction } from '../types';
import { buildPaymentRequestPayload, type CreateRequestInput } from '../utils/buildPaymentRequest';
import { canBeginPaymentConfirmation, canCompletePayment, DEMO_PAYMENT_FAILURE_RATE } from '../utils/paymentSimulation';
import { generateTxHash } from '../utils/ids';
import { useRequestEventStore } from './requestEventStore';
import { useTransactionStore } from './transactionStore';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface RequestState {
  requests: PaymentRequest[];
  isCreating: boolean;
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  createRequest: (userId: string, input: CreateRequestInput) => Promise<PaymentRequest>;
  getRequestById: (id: string) => PaymentRequest | undefined;
  cancelRequest: (userId: string, id: string) => Promise<void>;
  deleteRequest: (userId: string, id: string) => Promise<void>;
  beginPaymentConfirmation: (userId: string, id: string) => Promise<boolean>;
  completePayment: (userId: string, id: string, options?: { forceFailure?: boolean }) => Promise<Transaction | null>;
  reset: () => void;
}

function mapRequestRow(row: {
  id: string;
  customer_id: string | null;
  payment_code: string;
  amount: string | number;
  currency: PaymentRequest['currency'];
  network: PaymentRequest['network'];
  description: string | null;
  note: string | null;
  expiry_option: PaymentRequest['expiryOption'];
  expires_at: string | null;
  status: PaymentRequest['status'];
  payment_link: string;
  created_at: string;
}): PaymentRequest {
  return {
    id: row.id,
    paymentCode: row.payment_code,
    amount: Number(row.amount),
    currency: row.currency,
    network: row.network,
    description: row.description ?? undefined,
    customerId: row.customer_id ?? undefined,
    expiryOption: row.expiry_option,
    expiresAt: row.expires_at,
    note: row.note ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    paymentLink: row.payment_link,
  };
}

function mapTransactionRow(row: {
  id: string;
  payment_request_id: string;
  from_customer_id: string | null;
  amount: string | number;
  currency: Transaction['currency'];
  network: Transaction['network'];
  tx_hash: string;
  paid_at: string;
}): Transaction {
  return {
    id: row.id,
    requestId: row.payment_request_id,
    amount: Number(row.amount),
    currency: row.currency,
    network: row.network,
    fromCustomerId: row.from_customer_id ?? '',
    txHash: row.tx_hash,
    paidAt: row.paid_at,
  };
}

export const useRequestStore = create<RequestState>()((set, get) => ({
  requests: [],
  isCreating: false,
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ requests: (data ?? []).map(mapRequestRow), status: 'loaded' });
    } catch (error) {
      set({ status: 'error', error: getDataErrorMessage(error, 'requests') });
    }
  },

  createRequest: async (userId, input) => {
    set({ isCreating: true });
    try {
      const payload = buildPaymentRequestPayload(input);
      const { data, error } = await supabase.rpc('create_payment_request', {
        p_customer_id: payload.customerId ?? null,
        p_wallet_id: null,
        p_payment_code: payload.paymentCode,
        p_amount: payload.amount,
        p_description: payload.description ?? null,
        p_note: payload.note ?? null,
        p_expiry_option: payload.expiryOption,
        p_expires_at: payload.expiresAt,
        p_payment_link: payload.paymentLink,
      });
      if (error) throw error;
      const request = mapRequestRow(data);
      set((state) => ({ requests: [request, ...state.requests], isCreating: false }));
      useRequestEventStore.getState().addLocal({ id: `${request.id}-created`, requestId: request.id, type: 'created', occurredAt: request.createdAt });
      return request;
    } catch (error) {
      set({ isCreating: false, error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
  },

  getRequestById: (id) => get().requests.find((r) => r.id === id),

  cancelRequest: async (userId, id) => {
    const request = get().requests.find((r) => r.id === id);
    if (!request || request.status === 'paid' || request.status === 'expired' || request.status === 'cancelled') {
      return;
    }
    const { data: succeeded, error } = await supabase.rpc('cancel_payment_request', { p_request_id: id });
    if (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
    if (!succeeded) return;
    set((state) => ({ requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)) }));
    useRequestEventStore.getState().addLocal({ id: `${id}-cancelled-${Date.now()}`, requestId: id, type: 'cancelled', occurredAt: new Date().toISOString() });
  },

  deleteRequest: async (userId, id) => {
    // Plain RLS-guarded delete — ON DELETE CASCADE on request_events and
    // transactions removes both atomically, no RPC needed (design doc 3.3).
    const { error } = await supabase.from('payment_requests').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
    set((state) => ({ requests: state.requests.filter((r) => r.id !== id) }));
    useRequestEventStore.setState((state) => ({ events: state.events.filter((e) => e.requestId !== id) }));
    useTransactionStore.setState((state) => ({ transactions: state.transactions.filter((t) => t.requestId !== id) }));
  },

  beginPaymentConfirmation: async (userId, id) => {
    const request = get().requests.find((r) => r.id === id);
    if (!canBeginPaymentConfirmation(request)) return false;

    const { data: succeeded, error } = await supabase.rpc('begin_payment_confirmation', { p_request_id: id });
    if (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
    if (!succeeded) return false;

    set((state) => ({ requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'confirming' } : r)) }));
    useRequestEventStore.getState().addLocal({ id: `${id}-detected-${Date.now()}`, requestId: id, type: 'payment_detected', occurredAt: new Date().toISOString() });
    return true;
  },

  completePayment: async (userId, id, options) => {
    const request = get().requests.find((r) => r.id === id);
    if (!canCompletePayment(request)) return null;

    const shouldFail = options?.forceFailure ?? Math.random() < DEMO_PAYMENT_FAILURE_RATE;
    const { data, error } = await supabase.rpc('complete_payment', {
      p_request_id: id,
      p_should_fail: shouldFail,
      p_tx_hash: generateTxHash(),
    });
    if (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }

    if (!data) {
      set((state) => ({ requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'pending' } : r)) }));
      useRequestEventStore.getState().addLocal({ id: `${id}-failed-${Date.now()}`, requestId: id, type: 'payment_failed', occurredAt: new Date().toISOString() });
      return null;
    }

    const transaction = mapTransactionRow(data);
    useTransactionStore.getState().addLocal(transaction);
    set((state) => ({ requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'paid' } : r)) }));
    useRequestEventStore.getState().addLocal({ id: `${id}-confirmed-${Date.now()}`, requestId: id, type: 'payment_confirmed', occurredAt: new Date().toISOString() });
    return transaction;
  },

  reset: () => set({ requests: [], isCreating: false, status: 'idle', error: null }),
}));

registerResettable(() => useRequestStore.getState().reset());
```

**Note on `addLocal`'s synthetic event ids:** these are client-side cache keys only (`${requestId}-created`, `${requestId}-cancelled-${Date.now()}`, etc.), never written to the database — the real event row (with its real Postgres UUID) was already inserted server-side inside the RPC. This is a deliberate simplification: re-fetching the real id via an extra round trip after every RPC call isn't justified for a locally-rendered timeline list that's keyed by array position in practice (`events.map((event, index) => <View key={event.id}>`) — if this proves to cause any real rendering issue, switch `loadForUser` to be re-called after each mutation instead of local cache merging (a one-line change, not a redesign) rather than plumbing real ids through every RPC's response shape.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/store/__tests__/requestStore.test.ts src/store/__tests__/requestEventStore.test.ts src/store/__tests__/transactionStore.test.ts`
Expected: PASS (write minimal `requestEventStore.test.ts`/`transactionStore.test.ts` covering `loadForUser` mapping and `reset`, mirroring the pattern already shown for `customerStore`/`templateStore` tests in Tasks 9-10 — mock `supabase.from`, assert the mapped shape and `reset()` behavior).

- [ ] **Step 6: Add all three stores' `loadForUser(userId)` calls to the `app/_layout.tsx` bootstrap effect.**

- [ ] **Step 7: Update call sites**

`app/request/details.tsx` — `createRequest({...})` → `await createRequest(userId, {...})` (add `useAuthStore` import/selector, guard). `addCustomer({...})` (already updated in Task 9's `customerStore` signature — confirm this file's call site was included there; if not, fix it here) → `addCustomer(userId, {...})`.

`app/(app)/requests/[id].tsx` — `cancelRequest(request.id)` → `await cancelRequest(userId, request.id)`; `deleteRequest(request.id)` → `await deleteRequest(userId, request.id)`; `addEvent(request.id, 'shared')`/`addEvent(request.id, 'reminder_sent')` (Share Again / Send Reminder — these are **not** part of the RPC-covered set, they're simple single-row inserts) → replace `useRequestEventStore((state) => state.addEvent)` with a direct insert:

```ts
async function recordEvent(requestId: string, type: 'shared' | 'reminder_sent') {
  if (!userId) return;
  const { data, error } = await supabase
    .from('request_events')
    .insert({ user_id: userId, payment_request_id: requestId, event_type: type })
    .select('*')
    .single();
  if (!error && data) {
    useRequestEventStore.getState().addLocal({ id: data.id, requestId: data.payment_request_id, type: data.event_type, occurredAt: data.occurred_at });
  }
}
```
(add `import { supabase } from '../../../src/lib/supabase';` and `const userId = useAuthStore((state) => state.user?.id);`; call `await recordEvent(request.id, 'shared')` / `await recordEvent(request.id, 'reminder_sent')` in place of the old `addEvent` calls, making `handleShareAgain`/`handleSendReminder` unaffected in structure otherwise.)

`app/(app)/requests/index.tsx` — add the same loading/error `ListEmptyComponent` treatment as Task 9's customers list, reading `useRequestStore`'s `status`/`error`.

`app/request/created.tsx` — no store-write changes needed (pure reads); confirm it still compiles against the new `PaymentRequest` shape (it will — the type didn't change, only how rows are produced).

- [ ] **Step 8: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add -A
git commit -m "Migrate requests, request events, and transactions to Supabase via RPC-backed multi-write actions"
```

---

### Task 12: Cross-user isolation tests

**Files:**
- Test: `src/store/__tests__/dataLifecycle.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/store/__tests__/dataLifecycle.test.ts
import { registerResettable, resetAllUserData } from '../dataLifecycle';

describe('resetAllUserData', () => {
  it('calls every registered resetter', () => {
    const a = jest.fn();
    const b = jest.fn();
    registerResettable(a);
    registerResettable(b);

    resetAllUserData();

    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx jest src/store/__tests__/dataLifecycle.test.ts`
Expected: PASS (this module has no external dependencies to mock)

- [ ] **Step 3: Write a store-level cross-user isolation regression test**

Add to `src/store/__tests__/customerStore.test.ts` (representative of the pattern — the same story applies to every migrated store, this one test stands in for the class of bug this whole phase exists to fix):

```ts
it('does not leak User A\'s cached customers into User B\'s session after a reset + reload', async () => {
  const userABuilder = makeQueryBuilder({
    data: [{ id: 'a1', name: 'Alice Customer', email: 'a@x.com', avatar_color: 'blue', company: null, notes: null }],
    error: null,
  });
  mockedSupabase.from.mockReturnValue(userABuilder as never);
  await useCustomerStore.getState().loadForUser('user-A');
  expect(useCustomerStore.getState().customers).toHaveLength(1);

  useCustomerStore.getState().reset();
  expect(useCustomerStore.getState().customers).toEqual([]);

  const userBBuilder = makeQueryBuilder({ data: [], error: null });
  mockedSupabase.from.mockReturnValue(userBBuilder as never);
  await useCustomerStore.getState().loadForUser('user-B');

  expect(useCustomerStore.getState().customers).toEqual([]);
  expect(useCustomerStore.getState().customers.some((c) => c.name === 'Alice Customer')).toBe(false);
});
```

- [ ] **Step 4: Run full suite, then commit**

```bash
npx jest
git add src/store/__tests__/dataLifecycle.test.ts src/store/__tests__/customerStore.test.ts
git commit -m "Add cross-user isolation regression tests"
```

---

### Task 13: Final regression pass, manual scenario trace, and RLS manual verification steps

**Files:** none (verification + a docs artifact only)

- [ ] **Step 1: Full clean verification**

```bash
npx tsc --noEmit
npx jest --silent
```

Expected: `tsc` clean; every suite passing — count what actually runs, don't hardcode an expected number.

- [ ] **Step 2: Manual scenario trace (code-level, no live project) against phase brief §31's criteria**

Walk the actual code (not a device) for: new user sign-up → onboarding (profile/business/wallet all persist, `onboarding_completed` only flips true after the wallet save succeeds) → Home; existing user sign-in → profile/customers/requests/templates/transactions all load scoped to `auth.uid()`; create request → RPC inserts request + `created` event together; demo payment flow → `beginPaymentConfirmation` → `completePayment` → transaction cached + status flips to `paid` + `payment_confirmed` event, matching the exact pre-migration UI states; invoice/receipt still derive from the same `PaymentRequest`/`Customer`/`Profile`/`Transaction` shapes (types didn't change, only their source); sign out → `resetAllUserData()` clears every store; sign back in as a different user → nothing from the first user renders before the second user's fetches resolve. Fix anything that doesn't hold — do not defer a real gap found here.

- [ ] **Step 3: Write the RLS manual verification doc**

```markdown
<!-- docs/superpowers/phase-2b-rls-manual-verification.md -->
# Phase 2B — Manual RLS Verification

Run once the three migrations (0001, 0002, 0003) have been applied via the Supabase Dashboard's SQL Editor, in that order.

## Setup
1. Create two real accounts through the app (sign up twice with different emails) — call them **User A** and **User B**.
2. As User A: add one customer, set a wallet address, create one payment request, and run it through the demo payment flow to completion (so a transaction row exists too).

## Verification A: each user sees only their own data (app-level)
1. Sign out, sign in as **User B**.
2. Confirm: Customers list is empty, Requests list is empty, Wallet Settings shows no address, Templates list is empty (or only whatever User B has created).
3. Confirm none of User A's data (customer name, request amount/description, wallet address) appears anywhere.

## Verification B: RLS itself, not just the app UI (Supabase SQL Editor)
Run as the `postgres`/service role in the SQL Editor (this bypasses RLS by design — it's how you inspect ground truth):

```sql
select id, user_id, name from public.customers order by created_at desc limit 5;
select id, user_id, address from public.wallets order by created_at desc limit 5;
select id, user_id, payment_code, amount from public.payment_requests order by created_at desc limit 5;
select id, user_id, tx_hash from public.transactions order by created_at desc limit 5;
```
Confirm every row's `user_id` matches the account that actually created it — this is ground truth for what RLS *should* be enforcing.

Then, in the **Authentication → Users** section, copy User A's UID. In the SQL Editor, simulate being User B by using the `authenticator` role with an RLS-respecting query (the Dashboard's SQL Editor runs as a superuser and bypasses RLS by default, so this step specifically needs to go through the app or `supabase-js` with User B's real session — not the SQL Editor — to be a true RLS test):

1. In the app, while signed in as **User B**, open browser/Metro dev tools network inspection (or just trust the UI check in Verification A, which already reflects real RLS-filtered responses since the app only ever uses the anon key + the signed-in user's JWT, never a service role).
2. As a stronger check: in the SQL Editor, run `set role authenticated; set request.jwt.claims = '{"sub":"<User B's UID>"}'; select * from public.customers;` (then `reset role;` after) — this should return zero rows for User A's customers even though they exist in the table, proving the policy — not just client-side filtering — is what's blocking access.

## Verification C: cannot write to another user's rows
While signed in as User B (via the app, or `supabase-js` with User B's session), attempt:
```ts
await supabase.from('customers').update({ name: 'Hacked' }).eq('id', '<User A\'s customer id>');
```
Expected: the update affects 0 rows (RLS `USING` clause silently filters it out — no error, just no match), and User A's customer name is unchanged when checked via the SQL Editor.

Repeat for `wallets`, `payment_requests`, `transactions` with an UPDATE and a DELETE attempt each, confirming 0 rows affected every time.
```

- [ ] **Step 4: Commit the verification doc**

```bash
git add docs/superpowers/phase-2b-rls-manual-verification.md
git commit -m "Add manual RLS verification steps for Phase 2B"
```

---

## Post-plan (not plan tasks — handled by the controlling session directly)

- Final holistic review across the whole branch diff (`master..HEAD`), per established project process.
- `superpowers:finishing-a-development-branch` to merge.
- Final report in the format the phase brief's §32 requests, including the SQL files the user must run and in what order.
- Update project memory.
- Do **not** start the next phase without explicit user approval.
