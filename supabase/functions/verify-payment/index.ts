// Phase 3D's trusted server-side verification boundary. Runs as a Supabase
// Edge Function (Deno), invoked two ways:
//
//  1. By the anonymous public checkout page, via
//     supabase.functions.invoke('verify-payment', { body: { public_token } }).
//     The client sends only the public_token -- the same opaque bearer value
//     the checkout page already uses to read a request's public data. It is
//     NEVER trusted for amount, wallet, status, or anything else: this
//     function loads the payment_requests row itself (via the service-role
//     key, which bypasses RLS -- there is no anon/authenticated grant on the
//     two completion RPCs this function calls, so nothing else can reach
//     them) and independently derives the truth from Solana before ever
//     writing anything.
//
//  2. Phase 5A's sweep mode, via a scheduled cron trigger (see deployment
//     notes at the bottom of this file), body `{ sweep: true }`, guarded by
//     a shared secret header exactly like process-reminders' own cron path.
//     Nothing about a real payment's verification depends on the payer's
//     checkout page still being open in a browser tab -- a payer who
//     completes a wallet approval and then closes the tab (a common mobile
//     deep-link pattern) would otherwise leave their request stuck in
//     pending/confirming forever, since verify-payment was previously ONLY
//     ever invoked by that same page's own polling loop. Sweep mode re-runs
//     the identical per-request verification below against every open
//     request on a schedule, independent of any client being present.
//
// Every actual verification check (mint, destination wallet, exact
// amount, transaction success, confirmation level, expiry,
// already-credited) lives in ../../../src/services/blockchain/solana/ --
// paymentVerifier.ts / transactionParser.ts / paymentMatcher.ts /
// findPaymentForRequest.ts -- imported here unchanged. This file only
// does Deno/HTTP/Supabase plumbing around that shared logic; it never
// re-implements or bypasses any of it. verifyOneRequest() below is the one
// place that plumbing lives, shared byte-for-byte between both entry points
// so sweep mode can never quietly drift from what the single-token path does.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clusterApiUrl } from '@solana/web3.js';
import { PublicRpcProvider } from '../../../src/services/blockchain/solana/client.ts';
import { findPaymentForRequest } from '../../../src/services/blockchain/solana/findPaymentForRequest.ts';
import { getAssetMint, getAssetDecimals, isSupportedAsset, type AssetSymbol } from '../../../src/config/assets.ts';
import { toBaseUnits, fromBaseUnits } from '../../../src/services/blockchain/solana/amount.ts';
import { computeDepositAmount } from '../../../src/utils/paymentAccounting.ts';
import { isAuthorizedCronRequest } from '../../../src/utils/cronAuth.ts';
import type { ExpectedPayment, SolanaEnvironment } from '../../../src/services/blockchain/solana/types.ts';
import type { DepositType } from '../../../src/types/recurring.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Bounds one sweep invocation's work the same way findPaymentForRequest
// already bounds its own -- a fixed batch, not "every open request ever",
// so a huge backlog degrades into "takes several cron ticks to catch up",
// never into one Edge Function invocation timing out or hammering the RPC.
const SWEEP_BATCH_LIMIT = 25;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// Signatures are public on-chain data, not secrets -- abbreviating them in
// logs is a readability/hygiene choice (spec section 13), not a security
// requirement the way withholding a private key would be.
function abbreviateSignature(signature: string): string {
  return signature.length <= 12 ? signature : `${signature.slice(0, 6)}…${signature.slice(-6)}`;
}

// Deliberately NOT reusing src/services/blockchain/solana/config.ts's
// getSolanaEnvironment()/getSolanaRpcUrl(): those read EXPO_PUBLIC_*
// client-bundle env vars, which is the wrong namespace for a server
// secret/config boundary. This server has its own independent config --
// SOLANA_NETWORK/SOLANA_RPC_URL, never exposed to any client bundle.
// Same fail-safe default as the client side: devnet unless mainnet-beta
// is explicitly configured, so a misconfigured deploy never silently
// verifies against real money.
function getServerSolanaNetwork(): SolanaEnvironment {
  return Deno.env.get('SOLANA_NETWORK') === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
}

function getServerSolanaRpcUrl(network: SolanaEnvironment): string {
  return Deno.env.get('SOLANA_RPC_URL') || clusterApiUrl(network);
}

interface PaymentRequestRow {
  id: string;
  user_id: string;
  amount: number | string;
  currency: string;
  status: string;
  expires_at: string | null;
  solana_reference: string | null;
  allow_partial_payments: boolean;
  deposit_type: DepositType | null;
  deposit_value: number | string | null;
}

const PAYMENT_REQUEST_SELECT =
  'id, user_id, amount, currency, status, expires_at, solana_reference, allow_partial_payments, deposit_type, deposit_value';

interface VerifyOutcome {
  status: string;
  note?: string;
}

// The one place a single payment_requests row is actually checked against
// Solana and (if warranted) credited. Called once per request by the
// public_token path, and once per claimed row by sweep mode -- identical
// logic either way, so sweep mode can never behave differently from what a
// payer's own checkout page already triggers.
async function verifyOneRequest(supabase: SupabaseClient, request: PaymentRequestRow): Promise<VerifyOutcome> {
  // Nothing to verify for a request that isn't (still) open. This also
  // covers 'paid' -- once paid, verify-payment never re-touches it.
  if (request.status !== 'pending' && request.status !== 'confirming') {
    return { status: request.status };
  }

  // 'expired' is never actually written to payment_requests.status
  // anywhere in this app today (it's a client-computed display concept
  // -- see expiry.ts). Guard on the real expires_at column directly so
  // a request whose time has passed can never be moved to confirming/paid
  // here, regardless of what its status column still says.
  if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
    return { status: request.status };
  }

  if (!request.solana_reference) {
    // Pre-Phase-3C request with no reference to look up -- nothing this
    // function can do for it.
    return { status: request.status };
  }

  const { data: walletRow } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', request.user_id)
    .maybeSingle();
  const wallet = walletRow as { address: string } | null;

  if (!wallet?.address) {
    // No receiving wallet configured -- same as Phase 3B/3C's public
    // checkout page, which already hides Pay controls in this case.
    return { status: request.status };
  }

  // Phase 7: verify the payment asset THIS REQUEST actually expects, never
  // a hardcoded default. request.currency is only ever written as one of
  // the allowlisted values in src/config/assets.ts (DB CHECK constraint,
  // see the Phase 7 migration) -- an unrecognized value here means data
  // corruption or a pre-migration/legacy row this function has no business
  // guessing about, so it fails closed (skips verification) rather than
  // silently defaulting to USDC. This is also what makes a EURC payment
  // structurally unable to satisfy a USDC request or vice versa: the mint
  // fed into `expected` below always comes from THIS row's own currency.
  if (!isSupportedAsset(request.currency)) {
    console.error(`verify-payment: request ${request.id} has an unrecognized currency "${request.currency}" -- skipping`);
    return { status: request.status };
  }
  const asset: AssetSymbol = request.currency;

  console.log(`verify-payment: verification requested for request ${request.id} (status=${request.status}, asset=${asset})`);

  const network = getServerSolanaNetwork();
  const mint = getAssetMint(asset, network);
  const decimals = getAssetDecimals(asset);
  const totalBaseUnits = toBaseUnits(String(request.amount), decimals);

  const expected: ExpectedPayment = {
    network,
    mint: mint,
    destinationWallet: wallet.address,
    amountBaseUnits: totalBaseUnits,
    notAfter: request.expires_at ? new Date(request.expires_at) : null,
  };

  // Partial-payment-enabled requests accept any amount in
  // [deposit-or-any, remaining] instead of requiring an exact match --
  // both bounds are re-derived HERE, from the real sum of already-
  // credited transactions, every single call. Never cached, never
  // trusted from an earlier check: the remaining balance shrinks with
  // every successful partial payment, so the upper bound (which is also
  // what makes crediting an overpayment impossible) must always reflect
  // the current true state, not a stale one.
  if (request.allow_partial_payments) {
    const { data: paidRows, error: paidError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('payment_request_id', request.id);
    if (paidError) {
      console.error(`verify-payment: failed to sum existing transactions for ${request.id}`, paidError);
      return { status: request.status };
    }
    const paidBaseUnits = (paidRows ?? []).reduce(
      (sum, row) => sum + toBaseUnits(String((row as { amount: number | string }).amount), decimals),
      0n
    );
    const remainingBaseUnits = paidBaseUnits >= totalBaseUnits ? 0n : totalBaseUnits - paidBaseUnits;

    if (remainingBaseUnits <= 0n) {
      // Already fully covered by transactions complete_verified_payment
      // hasn't yet flipped the status for (or a defensive no-op if this
      // is ever reached in an inconsistent state) -- nothing to verify.
      return { status: request.status };
    }

    const isFirstPayment = paidBaseUnits === 0n;
    const depositAmount = isFirstPayment
      ? computeDepositAmount(Number(request.amount), request.deposit_type ?? undefined, request.deposit_value != null ? Number(request.deposit_value) : undefined, asset)
      : undefined;
    const minBaseUnits = depositAmount != null ? toBaseUnits(depositAmount, decimals) : 1n;

    expected.minAmountBaseUnits = minBaseUnits;
    expected.maxAmountBaseUnits = remainingBaseUnits;
  }

  const provider = new PublicRpcProvider(getServerSolanaRpcUrl(network));
  const isSignatureAlreadyUsed = async (signature: string): Promise<boolean> => {
    const { data, error: usedCheckError } = await supabase
      .from('transactions')
      .select('id')
      .eq('tx_hash', signature)
      .maybeSingle();
    if (usedCheckError) {
      // Not a fund-safety risk either way -- complete_verified_payment
      // independently re-checks tx_hash under its own row lock, backed
      // by the UNIQUE constraint -- but treating a real DB error as
      // "definitely not used" would silently mask it. Fail toward "can't
      // tell yet" (rpc_unavailable, same as a chain RPC failure) instead
      // of guessing.
      console.error('verify-payment: failed to check for an already-used signature', usedCheckError);
      throw usedCheckError;
    }
    return !!data;
  };

  const outcome = await findPaymentForRequest(request.solana_reference, expected, {
    discoveryProvider: provider,
    rpcProvider: provider,
    isSignatureAlreadyUsed,
  });

  switch (outcome.kind) {
    case 'paid': {
      console.log(
        `verify-payment: transaction found and fully verified for request ${request.id} (signature=${abbreviateSignature(outcome.result.signature)})`
      );
      // The actual verified transfer amount (which, for a partial
      // payment, is whatever the payer sent within the accepted range --
      // never assumed to equal the request's full amount) is what gets
      // credited, converted back from base units to a decimal string so
      // no JS floating-point ever touches the value on its way into a
      // `numeric` column.
      const { data: transactions, error: completeError } = await supabase.rpc('complete_verified_payment', {
        p_request_id: request.id,
        p_tx_hash: outcome.result.signature,
        p_amount: fromBaseUnits(outcome.result.amountBaseUnits, decimals),
      });
      if (completeError) {
        console.error(`verify-payment: complete_verified_payment failed for ${request.id}`, completeError);
        return { status: request.status };
      }
      const completed = Array.isArray(transactions) && transactions.length > 0;
      if (!completed) {
        // Row lock + tx_hash uniqueness rejected it -- almost always means
        // a concurrent invocation already completed the same request.
        console.log(`verify-payment: request ${request.id} already finalized by a concurrent verification (duplicate signature or already paid)`);
        return { status: request.status };
      }

      // A partial-payment-enabled request's credited amount may not have
      // reached the full total -- complete_verified_payment itself
      // decides paid vs. still-pending (never assumed 'paid' here just
      // because a transaction was recorded).
      const { data: refreshedRow } = await supabase
        .from('payment_requests')
        .select('status')
        .eq('id', request.id)
        .maybeSingle();
      const finalStatus = (refreshedRow as { status: string } | null)?.status ?? request.status;
      console.log(`verify-payment: request ${request.id} credited (status=${finalStatus})`);
      return { status: finalStatus };
    }

    case 'confirming': {
      console.log(`verify-payment: request ${request.id} confirming (transaction found, not yet at required confirmation level)`);
      const { error: detectError } = await supabase.rpc('mark_payment_detected', { p_request_id: request.id });
      if (detectError) {
        console.error(`verify-payment: mark_payment_detected failed for ${request.id}`, detectError);
        return { status: request.status };
      }
      return { status: 'confirming' };
    }

    case 'rpc_unavailable':
      console.warn(`verify-payment: Solana RPC unavailable while checking request ${request.id}`);
      return { status: request.status, note: 'rpc_unavailable' };

    case 'no_match':
      // lastReason is the specific reason the closest candidate (if any)
      // didn't qualify -- e.g. wrong_amount, wrong_mint, wrong_destination,
      // already_credited, transaction_failed, expired. Absent entirely
      // means no candidate signature existed for this reference yet
      // (the ordinary case while a payer hasn't paid at all).
      console.log(`verify-payment: no qualifying transaction for request ${request.id} (last candidate reason: ${outcome.lastReason ?? 'no candidates found'})`);
      return { status: request.status };

    default:
      return { status: request.status };
  }
}

// Phase 5C observability: one summary row per sweep invocation -- see
// process-reminders'/process-recurring-plans' identical helper and
// migration 0016's own comment for why this table is deliberately not
// merchant-visible. Never called from the ordinary public_token path --
// that one runs once per payer poll (every few seconds), far too often to
// treat as a meaningful "automation run" the way a scheduled sweep is.
async function recordRun(
  supabase: SupabaseClient,
  startedAt: Date,
  checkedCount: number,
  succeededCount: number,
  skippedCount: number,
  failedCount: number,
  error?: string
): Promise<void> {
  try {
    await supabase.from('automation_runs').insert({
      function_name: 'verify-payment-sweep',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      claimed_count: checkedCount,
      succeeded_count: succeededCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      error: error ?? null,
    });
  } catch (insertError) {
    console.error('verify-payment: failed to record automation_runs row', insertError);
  }
}

function getSupabaseAdminClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('verify-payment: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// Sweep mode: re-checks every still-open, reference-bearing request that
// hasn't expired, independent of any payer's checkout page being open.
// Guarded by a shared cron secret, the exact same posture
// process-reminders' own scheduled path already established -- see this
// file's deployment notes. One bad row (a transient error verifying it)
// is logged and skipped, never allowed to abort the rest of the batch,
// same reasoning as findPaymentForRequest's own "one malformed candidate
// must never hide a good one" rule.
async function handleSweep(req: Request): Promise<Response> {
  const runStartedAt = new Date();
  const configuredSecret = Deno.env.get('VERIFY_PAYMENT_CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  if (!isAuthorizedCronRequest(configuredSecret, providedSecret)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return json({ ok: false, error: 'server_misconfigured' }, 500);
  }

  const nowIso = new Date().toISOString();
  const { data: rows, error: fetchError } = await supabase
    .from('payment_requests')
    .select(PAYMENT_REQUEST_SELECT)
    .in('status', ['pending', 'confirming'])
    .not('solana_reference', 'is', null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('updated_at', { ascending: true })
    .limit(SWEEP_BATCH_LIMIT);

  if (fetchError) {
    console.error('verify-payment: sweep failed to load candidate requests', fetchError);
    await recordRun(supabase, runStartedAt, 0, 0, 0, 0, 'fetch_failed');
    return json({ ok: false, error: 'server_error' }, 500);
  }

  const candidates = (rows ?? []) as unknown as PaymentRequestRow[];
  let paid = 0;
  let confirming = 0;
  let unchanged = 0;
  let errored = 0;

  for (const request of candidates) {
    try {
      const outcome = await verifyOneRequest(supabase, request);
      if (outcome.status === 'paid') paid++;
      else if (outcome.status === 'confirming') confirming++;
      else unchanged++;
    } catch (error) {
      errored++;
      console.error(`verify-payment: sweep failed on request ${request.id}`, error);
    }
  }

  console.log(`verify-payment: sweep checked ${candidates.length} request(s) -- paid=${paid} confirming=${confirming} unchanged=${unchanged} errored=${errored}`);
  await recordRun(supabase, runStartedAt, candidates.length, paid + confirming, unchanged, errored);
  return json({ ok: true, checked: candidates.length, paid, confirming, unchanged, errored });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  let body: { public_token?: unknown; sweep?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  if (body.sweep === true) {
    return handleSweep(req);
  }

  try {
    const token = body.public_token;
    if (typeof token !== 'string' || !UUID_PATTERN.test(token)) {
      return json({ ok: false, error: 'invalid_request' }, 400);
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return json({ ok: false, error: 'server_misconfigured' }, 500);
    }

    const { data: requestRow, error: requestError } = await supabase
      .from('payment_requests')
      .select(PAYMENT_REQUEST_SELECT)
      .eq('public_token', token)
      .maybeSingle();

    if (requestError) {
      console.error('verify-payment: failed to load payment_requests row', requestError);
      return json({ ok: false, error: 'server_error' }, 500);
    }
    if (!requestRow) {
      return json({ ok: true, status: 'not_found' });
    }

    const outcome = await verifyOneRequest(supabase, requestRow as unknown as PaymentRequestRow);
    return json({ ok: true, ...outcome });
  } catch (error) {
    // Never let an unexpected exception leak a stack trace or internal
    // detail to the payer -- log server-side, respond generically.
    console.error('verify-payment: unexpected error', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
});

// --- Deployment (cannot be done from here -- no Supabase CLI/dashboard
// access in this environment) -----------------------------------------
//
// The public_token path (used by the checkout page) needs no setup beyond
// the ordinary `supabase functions deploy verify-payment` -- SUPABASE_URL
// and SUPABASE_SERVICE_ROLE_KEY are already provided automatically to every
// Edge Function by the platform, and the payer's own polling already
// invokes it correctly.
//
// Sweep mode is opt-in hardening (Phase 5A) that re-checks open requests on
// a schedule, so payments still get credited even if a payer closes their
// checkout tab right after paying. To enable it:
//
// 1. Deploy: `supabase functions deploy verify-payment`
// 2. Set one Edge Function secret (Supabase dashboard -> Edge Functions ->
//    verify-payment -> Secrets, or `supabase secrets set`):
//      VERIFY_PAYMENT_CRON_SECRET   -- any long random string you generate,
//      different from process-reminders' own REMINDER_CRON_SECRET
// 3. Schedule sweep invocations. Either:
//    a) Supabase dashboard -> Cron Jobs -> New job -> "Invoke an Edge
//       Function" -> verify-payment, schedule e.g. `*/2 * * * *` (every 2
//       minutes), request body `{"sweep": true}`, and add the header
//       `x-cron-secret: <the same VERIFY_PAYMENT_CRON_SECRET>`; or
//    b) via pg_cron + pg_net SQL, run once against your database:
//         select cron.schedule(
//           'verify-payment-sweep-every-2-min',
//           '*/2 * * * *',
//           $$
//           select net.http_post(
//             url := 'https://<project-ref>.supabase.co/functions/v1/verify-payment',
//             headers := jsonb_build_object(
//               'Content-Type', 'application/json',
//               'x-cron-secret', '<the same VERIFY_PAYMENT_CRON_SECRET>'
//             ),
//             body := '{"sweep": true}'::jsonb
//           );
//           $$
//         );
//
// Without this, verification still works correctly whenever a payer's own
// checkout page is open (it polls verify-payment itself) -- sweep mode is
// the fallback for the case where nothing is.
