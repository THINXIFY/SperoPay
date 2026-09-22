-- Fix: Archive Requests has been failing since it shipped.
--
-- Root cause: migration 0017 revoked UPDATE on public.payment_requests from
-- `authenticated` (deliberately -- closing a real direct-table-write gap;
-- see 0017's own comment). archiveRequest/restoreRequest were added after
-- 0017, using a direct `.from('payment_requests').update(...)` call --
-- exactly the pattern 0017 revoked. Every archive/restore attempt has
-- therefore failed at the table-grant level (Postgres 42501
-- insufficient_privilege), independent of RLS (which was and is fine).
--
-- Fixed the same way 0017 already fixed cancel_payment_request: a narrow
-- SECURITY DEFINER RPC that only ever touches archived_at, with ownership
-- enforced in the WHERE clause (independent of RLS, since DEFINER bypasses
-- RLS for the statements inside it). This never reopens the UPDATE grant --
-- doing so would also let a client rewrite status/amount/etc. directly on
-- payment_requests, the exact vulnerability 0017 closed.
create or replace function public.archive_payment_request(p_request_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archived_at timestamptz := now();
  v_updated int;
begin
  update public.payment_requests
  set archived_at = v_archived_at
  where id = p_request_id
    and user_id = auth.uid();

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return null;
  end if;

  return v_archived_at;
end;
$$;

create or replace function public.restore_payment_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated int;
begin
  update public.payment_requests
  set archived_at = null
  where id = p_request_id
    and user_id = auth.uid();

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

grant execute on function public.archive_payment_request(uuid) to authenticated;
grant execute on function public.restore_payment_request(uuid) to authenticated;
