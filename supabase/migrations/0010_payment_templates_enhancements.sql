-- Payment Templates: adds the fields the "save once, reuse anytime" redesign
-- needs -- an optional default customer, a flexible (nullable) amount, a
-- forward-compatible currency/token column, a per-template reminder
-- preference, and lightweight management (favorite, archive, usage
-- tracking) -- without touching any other table or existing RLS shape.
--
-- Column-additive only: RLS on payment_templates is row-level, keyed on
-- user_id = auth.uid() (see 0002_phase2b_rls.sql), which already covers
-- every column on the row including these new ones -- no policy changes
-- needed.

-- A template with no fixed amount ("flexible amount") is valid -- the user
-- enters the amount when they actually use it. The existing
-- `check (amount > 0)` constraint (unnamed, from 0001) is only evaluated
-- for non-null values, so dropping NOT NULL is sufficient: a NULL amount
-- passes the check automatically, and any amount that IS still provided
-- must still be positive.
alter table public.payment_templates alter column amount drop not null;

alter table public.payment_templates
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists currency text not null default 'USDC',
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists is_archived boolean not null default false,
  add column if not exists usage_count integer not null default 0,
  add column if not exists last_used_at timestamptz;

-- Matches payment_requests.customer_id's own on-delete behavior (0001) --
-- deleting a customer clears the template's default rather than deleting
-- the template itself.
create index if not exists idx_payment_templates_customer_id on public.payment_templates(customer_id);
