-- Client Portal redesign: each outstanding-request card must show a
-- customer-facing "request number" (spec) -- payment_code (e.g. "SP-XXXXX")
-- is exactly this: already shown publicly on /p/<token> checkout, invoices,
-- and receipts throughout the app, so it carries no new exposure. The
-- existing get_customer_portal_requests (0014) never selected it. Changing
-- a function's RETURNS TABLE column list requires dropping the old
-- signature first (same pattern as every other RPC signature change in
-- this project) -- CREATE OR REPLACE alone cannot add a column to an
-- existing RETURNS TABLE shape.
drop function if exists public.get_customer_portal_requests(uuid);

create or replace function public.get_customer_portal_requests(p_token uuid)
returns table (
  request_public_token uuid,
  payment_code text,
  description text,
  amount numeric,
  currency text,
  network text,
  status text,
  due_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
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
declare
  v_customer_id uuid;
  v_user_id uuid;
begin
  select c.id, c.user_id into v_customer_id, v_user_id
  from public.customers c
  where c.portal_token = p_token;

  if not found then
    return;
  end if;

  return query
  select
    pr.public_token as request_public_token,
    pr.payment_code,
    pr.description,
    pr.amount,
    pr.currency,
    pr.network,
    pr.status,
    pr.due_at,
    pr.expires_at,
    pr.created_at,
    pr.allow_partial_payments,
    pr.deposit_type,
    pr.deposit_value,
    coalesce(t.paid, 0) as verified_paid_amount,
    greatest(pr.amount - coalesce(t.paid, 0), 0) as remaining_amount
  from public.payment_requests pr
  left join lateral (
    select sum(amount) as paid from public.transactions where payment_request_id = pr.id
  ) t on true
  where pr.customer_id = v_customer_id and pr.user_id = v_user_id
  order by pr.created_at desc;
end;
$$;

grant execute on function public.get_customer_portal_requests(uuid) to anon;
grant execute on function public.get_customer_portal_requests(uuid) to authenticated;
