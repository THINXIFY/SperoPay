-- Corrective, standalone cleanup. Applies AFTER 0011 (already live in
-- production, treated as immutable -- never edited retroactively) and
-- AFTER 0012 (recurring payments + partial payments).
--
-- What actually happened: 0011, as originally applied to production,
-- re-declared create_payment_request with an added p_due_at parameter via
-- a bare `create or replace function` -- with NO preceding `drop function`
-- for 0006's old 10-argument signature
-- (uuid,uuid,text,numeric,text,text,text,timestamptz,text,text). Adding a
-- parameter changes a Postgres function's identity, so that old signature
-- was never replaced -- it was left behind, live, as a second, stale
-- overload sitting alongside the new 11-argument one.
--
-- This was caught during development of 0012 (before 0012 had been
-- applied anywhere), by which point 0011 was already live and is not to be
-- edited or re-run. 0011's own file in this repo has been restored to
-- exactly what actually ran in production (no drop-function statement) --
-- it must stay that way. This migration is the correct place for the fix
-- instead: a pure, additive-safe cleanup that touches no table data, no
-- rows, no reminder records, and no in-flight functionality.
--
-- By the time this migration runs, 0012 has already re-declared
-- create_payment_request again (adding partial-payment parameters), which
-- already correctly dropped the 11-argument signature as part of that
-- change. The ONLY overload still stale at this point is 0006's original
-- 10-argument one, which neither 0011 (as actually applied) nor 0012 ever
-- touched. `if exists` makes this a safe no-op if, for any reason, that
-- overload is not present when this runs.
drop function if exists public.create_payment_request(
  uuid, uuid, text, numeric, text, text, text, timestamptz, text, text
);

-- Sanity check (informational only -- does not fail the migration): after
-- this statement, exactly one create_payment_request overload should
-- exist. If this ever returns more than one row when run manually against
-- a real database, investigate before trusting the app's RPC calls.
-- select count(*) from pg_proc where proname = 'create_payment_request';
