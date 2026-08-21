-- Phase 2B: row-level security. Every table: owner-only select/insert/update/delete.
-- profiles is keyed by id (= auth.users.id) directly; every other table by user_id.
-- Every policy is dropped before being (re)created so this migration can be
-- pasted more than once (e.g. a retry after a partial failure) without
-- erroring on "policy already exists".

alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.customers enable row level security;
alter table public.payment_templates enable row level security;
alter table public.payment_requests enable row level security;
alter table public.request_events enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

drop policy if exists "business_profiles_select_own" on public.business_profiles;
create policy "business_profiles_select_own" on public.business_profiles for select using (auth.uid() = user_id);
drop policy if exists "business_profiles_insert_own" on public.business_profiles;
create policy "business_profiles_insert_own" on public.business_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "business_profiles_update_own" on public.business_profiles;
create policy "business_profiles_update_own" on public.business_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "business_profiles_delete_own" on public.business_profiles;
create policy "business_profiles_delete_own" on public.business_profiles for delete using (auth.uid() = user_id);

drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own" on public.wallets for select using (auth.uid() = user_id);
drop policy if exists "wallets_insert_own" on public.wallets;
create policy "wallets_insert_own" on public.wallets for insert with check (auth.uid() = user_id);
drop policy if exists "wallets_update_own" on public.wallets;
create policy "wallets_update_own" on public.wallets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wallets_delete_own" on public.wallets;
create policy "wallets_delete_own" on public.wallets for delete using (auth.uid() = user_id);

drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own" on public.customers for select using (auth.uid() = user_id);
drop policy if exists "customers_insert_own" on public.customers;
create policy "customers_insert_own" on public.customers for insert with check (auth.uid() = user_id);
drop policy if exists "customers_update_own" on public.customers;
create policy "customers_update_own" on public.customers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "customers_delete_own" on public.customers;
create policy "customers_delete_own" on public.customers for delete using (auth.uid() = user_id);

drop policy if exists "payment_templates_select_own" on public.payment_templates;
create policy "payment_templates_select_own" on public.payment_templates for select using (auth.uid() = user_id);
drop policy if exists "payment_templates_insert_own" on public.payment_templates;
create policy "payment_templates_insert_own" on public.payment_templates for insert with check (auth.uid() = user_id);
drop policy if exists "payment_templates_update_own" on public.payment_templates;
create policy "payment_templates_update_own" on public.payment_templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "payment_templates_delete_own" on public.payment_templates;
create policy "payment_templates_delete_own" on public.payment_templates for delete using (auth.uid() = user_id);

drop policy if exists "payment_requests_select_own" on public.payment_requests;
create policy "payment_requests_select_own" on public.payment_requests for select using (auth.uid() = user_id);
drop policy if exists "payment_requests_insert_own" on public.payment_requests;
create policy "payment_requests_insert_own" on public.payment_requests for insert with check (auth.uid() = user_id);
drop policy if exists "payment_requests_update_own" on public.payment_requests;
create policy "payment_requests_update_own" on public.payment_requests for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "payment_requests_delete_own" on public.payment_requests;
create policy "payment_requests_delete_own" on public.payment_requests for delete using (auth.uid() = user_id);

drop policy if exists "request_events_select_own" on public.request_events;
create policy "request_events_select_own" on public.request_events for select using (auth.uid() = user_id);
drop policy if exists "request_events_insert_own" on public.request_events;
create policy "request_events_insert_own" on public.request_events for insert with check (auth.uid() = user_id);
drop policy if exists "request_events_update_own" on public.request_events;
create policy "request_events_update_own" on public.request_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "request_events_delete_own" on public.request_events;
create policy "request_events_delete_own" on public.request_events for delete using (auth.uid() = user_id);

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions for select using (auth.uid() = user_id);
drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions for delete using (auth.uid() = user_id);
