// Phase 4A's server-side reminder processor. Runs as a Supabase Edge
// Function (Deno) on a schedule -- see the deployment notes at the bottom
// of this file. No client ever calls this: it must work correctly whether
// or not the app is open, unlike a local setTimeout/JS timer ever could.
//
// Flow per reminder: claim (atomically, via claim_due_reminders --
// migration 0011) -> re-verify eligibility against the LIVE payment_requests
// row -> attempt delivery through the ReminderDeliveryProvider abstraction
// -> record the real outcome -> move on. Nothing here ever trusts that a
// reminder's 'scheduled'/'processing' status alone still means it's safe to
// send -- see the eligibility re-check below, which is the actual guard.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NullDeliveryProvider } from '../../../src/services/reminderDelivery/nullDeliveryProvider.ts';
import { ResendDeliveryProvider } from '../../../src/services/reminderDelivery/resendDeliveryProvider.ts';
import { shouldRetryReminderDelivery } from '../../../src/services/reminderDelivery/shouldRetryReminderDelivery.ts';
import type { ReminderDeliveryProvider } from '../../../src/services/reminderDelivery/types.ts';
import { buildAutomaticReminderMessage } from '../../../src/utils/buildAutomaticReminderMessage.ts';
import { getPublicPaymentUrl } from '../../../src/utils/publicPaymentLink.ts';
import { isAuthorizedCronRequest } from '../../../src/utils/cronAuth.ts';
import { determineReminderIneligibilityReason } from '../../../src/utils/reminderEligibility.ts';
import type { ReminderRuleType } from '../../../src/types/reminder.ts';
import type { PaymentRequest } from '../../../src/types/payment.ts';
import type { Customer } from '../../../src/types/customer.ts';

// RESEND_API_KEY + REMINDER_FROM_EMAIL both present -> real delivery via
// Resend; either missing -> the safe NullDeliveryProvider fallback (every
// reminder ends up 'skipped' with an honest reason, exactly as it always
// has, never a fake 'sent'). This is the ONLY place either secret is read.
function getDeliveryProvider(): ReminderDeliveryProvider {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('REMINDER_FROM_EMAIL');
  if (apiKey && fromEmail) {
    return new ResendDeliveryProvider({ apiKey, fromEmail });
  }
  return new NullDeliveryProvider();
}

// A reminder that keeps erroring (a transient DB hiccup, not an
// ineligibility) gets this many total attempts before it's given up on and
// surfaced to the merchant as a real failure -- see the spec's "do not
// retry forever" requirement.
const MAX_ATTEMPTS = 3;
const CLAIM_LIMIT = 25;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Phase 5C observability: one summary row per invocation -- see
// process-recurring-plans' identical helper and migration 0016's own
// comment for why this table is deliberately not merchant-visible.
async function recordRun(
  supabase: SupabaseClient,
  startedAt: Date,
  claimedCount: number,
  succeededCount: number,
  skippedCount: number,
  failedCount: number,
  error?: string
): Promise<void> {
  try {
    await supabase.from('automation_runs').insert({
      function_name: 'process-reminders',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      claimed_count: claimedCount,
      succeeded_count: succeededCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      error: error ?? null,
    });
  } catch (insertError) {
    console.error('process-reminders: failed to record automation_runs row', insertError);
  }
}

interface ClaimedReminderRow {
  id: string;
  user_id: string;
  payment_request_id: string;
  schedule_id: string | null;
  reminder_type: 'before_due' | 'on_due' | 'after_due' | 'manual';
  attempt_count: number;
}

interface PaymentRequestRow {
  id: string;
  status: string;
  expires_at: string | null;
  due_at: string | null;
  amount: number | string;
  currency: string;
  description: string | null;
  payment_code: string;
  public_token: string;
  customer_id: string | null;
  allow_partial_payments: boolean;
}

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
}

interface ScheduleRow {
  id: string;
  enabled: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  // A shared cron secret, not a user JWT -- pg_cron (or an external
  // scheduler) has no interactive user to authenticate as, but this
  // function reaches across every merchant's data via the service-role
  // key, so it must not be reachable by anyone who merely knows the
  // project's public anon key. See this file's deployment notes.
  const configuredSecret = Deno.env.get('REMINDER_CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  if (!isAuthorizedCronRequest(configuredSecret, providedSecret)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('process-reminders: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
    return json({ ok: false, error: 'server_misconfigured' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const provider = getDeliveryProvider();
  const runStartedAt = new Date();

  const { data: claimed, error: claimError } = await supabase.rpc('claim_due_reminders', { p_limit: CLAIM_LIMIT });
  if (claimError) {
    console.error('process-reminders: claim_due_reminders failed', claimError);
    await recordRun(supabase, runStartedAt, 0, 0, 0, 0, 'claim_failed');
    return json({ ok: false, error: 'claim_failed' }, 500);
  }

  const reminders = (claimed ?? []) as ClaimedReminderRow[];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let retried = 0;

  for (const reminder of reminders) {
    try {
      const { data: requestRow, error: requestError } = await supabase
        .from('payment_requests')
        .select('id, status, expires_at, due_at, amount, currency, description, payment_code, public_token, customer_id, allow_partial_payments')
        .eq('id', reminder.payment_request_id)
        .maybeSingle();
      if (requestError) throw requestError;
      const request = requestRow as PaymentRequestRow | null;

      // The only thing that decides eligibility is the request's state
      // RIGHT NOW -- never the fact that this reminder was still
      // 'scheduled'/'processing' when claim_due_reminders picked it up a
      // moment (or, for a delayed/retried invocation, much longer) ago.
      // The actual decision is the pure, unit-tested
      // determineReminderIneligibilityReason -- this block only does the
      // I/O (fetching the request/schedule rows) it needs.
      let scheduleEnabled: boolean | null = null;
      if (reminder.schedule_id) {
        const { data: scheduleRow, error: scheduleError } = await supabase
          .from('payment_reminder_schedules')
          .select('id, enabled')
          .eq('id', reminder.schedule_id)
          .maybeSingle();
        if (scheduleError) throw scheduleError;
        const schedule = scheduleRow as ScheduleRow | null;
        scheduleEnabled = schedule?.enabled ?? false;
      }

      const ineligibleReason = determineReminderIneligibilityReason({
        request: request ? { status: request.status, expiresAt: request.expires_at } : null,
        scheduleEnabled,
      });

      if (ineligibleReason) {
        await supabase
          .from('payment_reminders')
          .update({ status: 'skipped', last_error: ineligibleReason })
          .eq('id', reminder.id)
          .eq('status', 'processing');
        skipped++;
        continue;
      }

      const paymentRequest = request as PaymentRequestRow;
      let customerName: string | undefined;
      let customerEmail: string | null = null;
      if (paymentRequest.customer_id) {
        const { data: customerRow } = await supabase
          .from('customers')
          .select('id, name, email')
          .eq('id', paymentRequest.customer_id)
          .maybeSingle();
        const customer = customerRow as CustomerRow | null;
        customerName = customer?.name;
        customerEmail = customer?.email ?? null;
      }

      // Merchant identity for the email's "from {Business Name}" header --
      // business_profiles.business_name first (what the merchant explicitly
      // set as their public-facing name), falling back to their account
      // display_name, same precedence this app's own screens already use
      // (e.g. Request Detail's businessName?.trim() || displayName?.trim()).
      const { data: businessRow } = await supabase
        .from('business_profiles')
        .select('business_name')
        .eq('user_id', reminder.user_id)
        .maybeSingle();
      let merchantName = (businessRow as { business_name: string | null } | null)?.business_name?.trim();
      if (!merchantName) {
        const { data: profileRow } = await supabase.from('profiles').select('display_name').eq('id', reminder.user_id).maybeSingle();
        merchantName = (profileRow as { display_name: string } | null)?.display_name?.trim();
      }
      merchantName = merchantName || 'Spero';

      // 'manual' reminders are never claimed here (they're inserted
      // already 'sent' -- see reminderStore.recordManualSend) but the type
      // system doesn't know that; fall back to the 'on_due' tone in the
      // impossible case rather than widening buildAutomaticReminderMessage's
      // signature for a state that can't actually occur.
      const ruleType: ReminderRuleType = reminder.reminder_type === 'manual' ? 'on_due' : reminder.reminder_type;
      // buildAutomaticReminderMessage only reads amount/currency/description/
      // publicToken off `request` and name off `customer` -- this function
      // has no reason to load or reconstruct the rest of either shape, so
      // these are deliberately partial fixtures, cast past the full
      // interface rather than fabricating fields nothing here needs.
      const messageRequest = {
        id: paymentRequest.id,
        amount: Number(paymentRequest.amount),
        currency: paymentRequest.currency,
        description: paymentRequest.description ?? undefined,
        publicToken: paymentRequest.public_token,
      } as unknown as PaymentRequest;
      const messageCustomer = customerName ? ({ name: customerName } as unknown as Customer) : undefined;

      // A partially-paid request's reminder must talk about what's still
      // owed, never the original total (spec: never re-remind someone
      // about an amount they've already paid down). Computed fresh from
      // real transactions every time, same as verify-payment's own
      // partial-payment accounting -- never cached on the reminder row.
      let remainingAmount: number | undefined;
      if (paymentRequest.allow_partial_payments) {
        const { data: paidRows } = await supabase
          .from('transactions')
          .select('amount')
          .eq('payment_request_id', paymentRequest.id);
        const paid = (paidRows ?? []).reduce((sum, row) => sum + Number((row as { amount: number | string }).amount), 0);
        remainingAmount = Math.max(0, Number(paymentRequest.amount) - paid);
      }

      const message = buildAutomaticReminderMessage(ruleType, messageRequest, messageCustomer, remainingAmount);
      // Same "remaining, not original" resolution buildAutomaticReminderMessage
      // itself uses internally for a partially-paid request -- the
      // structured "Amount:" the email shows must never contradict the
      // message body right next to it.
      const isPartialPayment = remainingAmount != null && remainingAmount < Number(paymentRequest.amount);
      const emailAmount = isPartialPayment ? (remainingAmount as number) : Number(paymentRequest.amount);

      const result = await provider.send({
        channel: 'email',
        customerName,
        customerEmail,
        merchantName,
        amount: emailAmount,
        currency: paymentRequest.currency,
        paymentCode: paymentRequest.payment_code,
        dueAt: paymentRequest.due_at,
        message,
        paymentLink: getPublicPaymentUrl(paymentRequest.public_token),
      });

      if (result.delivered) {
        // The ONLY code path in this function that may ever write
        // status: 'sent' -- reachable now whenever RESEND_API_KEY/
        // REMINDER_FROM_EMAIL are configured (see getDeliveryProvider above).
        await supabase
          .from('payment_reminders')
          .update({ status: 'sent', sent_at: new Date().toISOString(), delivery_channel: result.channel ?? 'email' })
          .eq('id', reminder.id)
          .eq('status', 'processing');
        await supabase.from('request_events').insert({
          user_id: reminder.user_id,
          payment_request_id: reminder.payment_request_id,
          event_type: 'reminder_sent',
        });
        // Phase 6C: same event, mirrored into the notifications table.
        await supabase.from('notifications').insert({
          user_id: reminder.user_id,
          type: 'reminder_sent',
          title: 'Reminder sent',
          message: customerName ? `A reminder was sent to ${customerName}.` : 'A payment reminder was sent.',
          entity_type: 'request',
          entity_id: reminder.payment_request_id,
        });
        sent++;
      } else if (shouldRetryReminderDelivery(result)) {
        // A plausibly transient delivery failure (e.g. a Resend outage) --
        // routed into the EXISTING attempt-count/MAX_ATTEMPTS mechanism
        // below by throwing, exactly the same way a transient DB error
        // already was. This is not a new retry mechanism: it's the same
        // one, now also reachable from a delivery failure, not only a
        // database one.
        throw new Error(result.reason ?? 'delivery_failed_retryable');
      } else {
        // A permanent, non-retryable outcome -- no automatic delivery
        // provider configured, no usable customer email, or the provider
        // permanently rejected the request. Writing 'sent' here would be
        // exactly the fake success this system explicitly forbids --
        // 'skipped' is a first-class, expected state, never surfaced to
        // the merchant as an error.
        await supabase
          .from('payment_reminders')
          .update({ status: 'skipped', last_error: result.reason ?? 'no_automatic_delivery_provider_configured' })
          .eq('id', reminder.id)
          .eq('status', 'processing');
        skipped++;
      }
    } catch (error) {
      console.error(`process-reminders: error processing reminder ${reminder.id}`, error);
      const nextAttempt = reminder.attempt_count + 1;
      // A retryable delivery failure throws with one of its own short,
      // safe, whitelisted reason strings (see the `throw new Error(result.
      // reason ...)` above) -- stored verbatim since it's already a
      // controlled, non-sensitive category, giving Logging real signal on
      // WHY a reminder is retrying/failing. Anything else (a raw DB/
      // Postgres error, an unexpected exception) keeps the existing
      // generic fallback -- never the raw error message, which could leak
      // internal detail into a column the merchant may be able to read.
      const isKnownDeliveryFailure = error instanceof Error && /^(resend_|delivery_failed_|unsupported_channel|no_customer_email)/.test(error.message);
      const lastError = isKnownDeliveryFailure ? (error as Error).message : 'processing_error';
      if (nextAttempt >= MAX_ATTEMPTS) {
        await supabase
          .from('payment_reminders')
          .update({ status: 'failed', attempt_count: nextAttempt, last_error: lastError })
          .eq('id', reminder.id);
        await supabase.from('request_events').insert({
          user_id: reminder.user_id,
          payment_request_id: reminder.payment_request_id,
          event_type: 'reminder_failed',
        });
        await supabase.from('notifications').insert({
          user_id: reminder.user_id,
          type: 'reminder_failed',
          title: "Reminder couldn't be sent",
          message: 'A payment reminder failed to send after multiple attempts.',
          entity_type: 'request',
          entity_id: reminder.payment_request_id,
        });
        failed++;
      } else {
        // Left for the next scheduled invocation to retry, capped at
        // MAX_ATTEMPTS -- never retried forever.
        await supabase
          .from('payment_reminders')
          .update({ status: 'scheduled', attempt_count: nextAttempt, last_error: lastError })
          .eq('id', reminder.id);
        retried++;
      }
    }
  }

  await recordRun(supabase, runStartedAt, reminders.length, sent, skipped, failed);
  return json({ ok: true, claimed: reminders.length, sent, skipped, failed, retried });
});

// --- Deployment (cannot be done from here -- no Supabase CLI/dashboard
// access in this environment) -----------------------------------------
//
// 1. Deploy: `supabase functions deploy process-reminders`
// 2. Set Edge Function secrets (Supabase dashboard -> Edge Functions ->
//    process-reminders -> Secrets, or `supabase secrets set`):
//      REMINDER_CRON_SECRET   -- any long random string you generate
//      (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already provided
//      automatically to every Edge Function by the platform.)
//
//    Optional, for REAL email delivery (without these, reminders keep
//    working exactly as before -- claimed, checked, marked 'skipped' with
//    an honest reason, never a fake 'sent'):
//      RESEND_API_KEY       -- an API key from your Resend account
//      REMINDER_FROM_EMAIL  -- the sending address, on a domain verified
//        in that same Resend account (e.g. reminders@yourdomain.com) --
//        Resend will reject sends from an unverified domain.
// 3. Schedule it to run every few minutes. Either:
//    a) Supabase dashboard -> Cron Jobs -> New job -> "Invoke an Edge
//       Function" -> process-reminders, schedule `*/5 * * * *`, and add
//       the header `x-cron-secret: <the same REMINDER_CRON_SECRET>`; or
//    b) via pg_cron + pg_net SQL, run once against your database:
//         select cron.schedule(
//           'process-reminders-every-5-min',
//           '*/5 * * * *',
//           $$
//           select net.http_post(
//             url := 'https://<project-ref>.supabase.co/functions/v1/process-reminders',
//             headers := jsonb_build_object(
//               'Content-Type', 'application/json',
//               'x-cron-secret', '<the same REMINDER_CRON_SECRET>'
//             ),
//             body := '{}'::jsonb
//           );
//           $$
//         );
