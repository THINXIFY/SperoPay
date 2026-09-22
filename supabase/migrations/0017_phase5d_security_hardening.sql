-- Phase 5D: Security & Production Hardening Audit.
--
-- Audit finding (HIGH): payment_requests_update_own and the transactions_*
-- policies (0002) are plain ownership policies with no column or origin
-- restriction -- Postgres RLS filters WHICH ROWS a policy applies to, never
-- WHICH COLUMNS or WHICH CALLER-CONTEXT can be written. Combined with
-- Supabase's default `grant all on all tables in schema public to
-- authenticated`, this means the row's own owner could, via a raw
-- REST/SDK call entirely outside this app's UI, directly:
--   - UPDATE their own payment_requests.status to 'paid' with zero
--     blockchain verification (the exact "client marks Paid" gap Phase 5A
--     closed for the legacy complete_payment/begin_payment_confirmation
--     RPCs, but the underlying table grant was never revisited then), or
--   - INSERT/UPDATE/DELETE transactions rows directly -- which would also
--     be visible to a CUSTOMER via get_public_payment_request's and the
--     client portal RPCs' verified_paid_amount (both SECURITY DEFINER,
--     so they read every transactions row regardless of who inserted it).
--
-- A full repo audit (grep for `.from('payment_requests')` /
-- `.from('transactions')` across src/ and app/) found NO legitimate direct
-- client write to either table: payment_requests is only ever read
-- (loadForUser) or deleted (deleteRequest, already RLS-owner-scoped and
-- untouched by this migration); transactions is only ever read
-- (loadForUser). Every real status transition already goes through an RPC.
-- Revoking the blanket grants below therefore breaks nothing working and
-- closes a real, previously-unaudited gap -- it does not touch RLS itself
-- (every SELECT/DELETE policy from 0002 is untouched), only the table-level
-- grants those policies gate.
revoke update on public.payment_requests from authenticated;
revoke insert, update, delete on public.transactions from authenticated;

-- cancel_payment_request (0003) is the ONE legitimate authenticated-facing
-- mutation of payment_requests.status ('pending'/'confirming' -> 'cancelled')
-- -- the revoke above would otherwise break it, since it runs SECURITY
-- INVOKER (as the calling role) today. Promoted to SECURITY DEFINER so it
-- keeps working under the new grants; safe to promote because its own body
-- already enforces `user_id = auth.uid()` in the WHERE clause, independent
-- of RLS, so ownership is still checked even though DEFINER bypasses RLS
-- entirely for the statements inside it. Every other authenticated-facing
-- RPC that ever touched payment_requests.status/transactions
-- (begin_payment_confirmation, complete_payment) was already revoked from
-- authenticated in migration 0015; mark_payment_detected and
-- complete_verified_payment were already service-role-only (0007/0012) --
-- none of those needed any change here.
create or replace function public.cancel_payment_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
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
