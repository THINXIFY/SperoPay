// Phase 4B's server-side recurring-generation processor. Runs as a
// Supabase Edge Function (Deno) on a schedule -- see the deployment notes
// at the bottom of this file, which mirror process-reminders' own (same
// scheduling PATTERN reused cleanly, per the spec; the two functions share
// no code and no tables beyond both reading payment_reminder_schedules/
// payment_reminders when generating a request's initial reminders).
//
// Flow per plan: claim (atomically, via claim_due_recurring_plans --
// migration 0012) -> generate the next payment_requests row (via
// generate_recurring_request, which re-validates the plan is still active
// and is itself idempotent) -> seed that request's initial reminders, if
// the plan has them enabled -> advance next_run_at -> move on.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { generatePaymentCode } from '../../../src/utils/ids.ts';
import { generateSolanaReference } from '../../../src/services/blockchain/solana/reference.ts';
import { getCheckoutBaseUrl } from '../../../src/utils/checkoutBaseUrl.ts';
import { addCalendarDays, computeNextRunAt } from '../../../src/utils/recurringSchedule.ts';
import { zonedTimeToUtc, getZonedDateParts, computeReminderOccurrences, rulesForPreset } from '../../../src/utils/reminderSchedule.ts';
import { isAuthorizedCronRequest } from '../../../src/utils/cronAuth.ts';
import type { RecurringFrequency, ReminderPreset, ReminderRule } from '../../../src/types/recurring.ts';

const CLAIM_LIMIT = 25;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Phase 5C observability: one summary row per invocation, written best-
// effort (a failure here must never fail the actual run it's describing --
// see the try/catch). Deliberately not merchant-visible -- see migration
// 0016's own comment on why this table has no RLS policies at all.
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
      function_name: 'process-recurring-plans',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      claimed_count: claimedCount,
      succeeded_count: succeededCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      error: error ?? null,
    });
  } catch (insertError) {
    console.error('process-recurring-plans: failed to record automation_runs row', insertError);
  }
}

// Phase 5C reliability: persists whether this ONE plan's generation attempt
// just succeeded or failed, so a merchant-visible "Needs Attention" surface
// (Automation Overview) has a real, RLS-scoped signal to read instead of
// silently retrying forever with no trace (see migration 0016). A success
// always resets the streak; a failure increments it -- never a bounded
// give-up here (a recurring plan should simply keep trying on its normal
// schedule, per this file's own original design note below), just an
// observable counter.
async function recordPlanAttempt(supabase: SupabaseClient, planId: string, succeeded: boolean, error?: string): Promise<void> {
  try {
    if (succeeded) {
      await supabase
        .from('recurring_payment_plans')
        .update({ consecutive_failures: 0, last_error: null, last_attempted_at: new Date().toISOString() })
        .eq('id', planId);
    } else {
      const { data } = await supabase
        .from('recurring_payment_plans')
        .select('consecutive_failures')
        .eq('id', planId)
        .maybeSingle();
      const previous = (data as { consecutive_failures: number } | null)?.consecutive_failures ?? 0;
      await supabase
        .from('recurring_payment_plans')
        .update({ consecutive_failures: previous + 1, last_error: error ?? 'generation_error', last_attempted_at: new Date().toISOString() })
        .eq('id', planId);
    }
  } catch (updateError) {
    console.error(`process-recurring-plans: failed to record attempt for plan ${planId}`, updateError);
  }
}

interface ClaimedPlanRow {
  id: string;
  user_id: string;
  occurrences_generated: number;
  due_date_offset_days: number | null;
  frequency: RecurringFrequency;
  custom_interval_days: number | null;
  next_run_at: string;
  send_hour: number;
  send_minute: number;
  timezone: string;
  reminders_enabled: boolean;
  reminder_preset: ReminderPreset;
  reminder_custom_rules: ReminderRule[] | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  // Same posture as process-reminders: a shared cron secret (its own,
  // independent value -- these two functions are deployed and secured
  // separately, deliberately not coupled) rather than a user JWT.
  const configuredSecret = Deno.env.get('RECURRING_CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  if (!isAuthorizedCronRequest(configuredSecret, providedSecret)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('process-recurring-plans: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
    return json({ ok: false, error: 'server_misconfigured' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const runStartedAt = new Date();

  const { data: claimed, error: claimError } = await supabase.rpc('claim_due_recurring_plans', { p_limit: CLAIM_LIMIT });
  if (claimError) {
    console.error('process-recurring-plans: claim_due_recurring_plans failed', claimError);
    await recordRun(supabase, runStartedAt, 0, 0, 0, 0, 'claim_failed');
    return json({ ok: false, error: 'claim_failed' }, 500);
  }

  const plans = (claimed ?? []) as ClaimedPlanRow[];
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const plan of plans) {
    try {
      const generationTime = new Date();
      let dueAtIso: string | null = null;
      if (plan.due_date_offset_days != null) {
        const parts = getZonedDateParts(generationTime, plan.timezone);
        const target = addCalendarDays(parts.year, parts.month, parts.day, plan.due_date_offset_days);
        dueAtIso = zonedTimeToUtc(target.year, target.month, target.day, plan.send_hour, plan.send_minute, plan.timezone).toISOString();
      }

      const occurrenceNumber = plan.occurrences_generated + 1;
      const paymentCode = generatePaymentCode();
      // Legacy/cosmetic field (see buildPaymentRequest.ts's identical
      // comment) -- payment_requests.payment_link is NOT NULL and written
      // at insert time, before the row's real public_token exists, so it
      // can never be a working link. Never rendered anywhere. Routed
      // through the same centralized getCheckoutBaseUrl() as every real
      // link so this doesn't hardcode a second copy of the domain.
      const paymentLink = `${getCheckoutBaseUrl()}/r/${paymentCode}`;
      const solanaReference = generateSolanaReference();

      const { data: requestRow, error: generateError } = await supabase.rpc('generate_recurring_request', {
        p_plan_id: plan.id,
        p_occurrence_number: occurrenceNumber,
        p_payment_code: paymentCode,
        p_payment_link: paymentLink,
        p_solana_reference: solanaReference,
        p_due_at: dueAtIso,
      });
      if (generateError) throw generateError;

      if (!requestRow) {
        // The plan was paused/ended between being claimed and processed --
        // generate_recurring_request's own re-check caught it. Nothing to
        // generate, and nothing to advance -- claim_due_recurring_plans
        // will simply never pick up an inactive plan again.
        await supabase.from('recurring_payment_plans').update({ processing_locked_until: null }).eq('id', plan.id);
        await recordPlanAttempt(supabase, plan.id, true);
        skipped++;
        continue;
      }

      const generatedRequest = requestRow as { id: string };

      if (plan.reminders_enabled && dueAtIso) {
        const rules = rulesForPreset(plan.reminder_preset, plan.reminder_custom_rules ?? undefined);
        const occurrences = computeReminderOccurrences(new Date(dueAtIso), rules, plan.send_hour, plan.send_minute, plan.timezone).filter(
          (occurrence) => occurrence.scheduledFor.getTime() > Date.now()
        );

        const { data: scheduleRow, error: scheduleError } = await supabase
          .from('payment_reminder_schedules')
          .insert({
            user_id: plan.user_id,
            payment_request_id: generatedRequest.id,
            enabled: true,
            preset: plan.reminder_preset,
            custom_rules: plan.reminder_preset === 'custom' ? (plan.reminder_custom_rules ?? []) : null,
            send_hour: plan.send_hour,
            send_minute: plan.send_minute,
            timezone: plan.timezone,
          })
          .select('id')
          .single();
        if (scheduleError) {
          console.error(`process-recurring-plans: failed to seed reminder schedule for request ${generatedRequest.id}`, scheduleError);
        } else if (occurrences.length > 0) {
          const { error: insertRemindersError } = await supabase.from('payment_reminders').insert(
            occurrences.map((occurrence) => ({
              user_id: plan.user_id,
              payment_request_id: generatedRequest.id,
              schedule_id: (scheduleRow as { id: string }).id,
              reminder_type: occurrence.rule.type,
              offset_value: occurrence.rule.offsetValue,
              offset_unit: occurrence.rule.offsetUnit,
              scheduled_for: occurrence.scheduledFor.toISOString(),
            }))
          );
          if (insertRemindersError) {
            console.error(`process-recurring-plans: failed to seed reminders for request ${generatedRequest.id}`, insertRemindersError);
          }
        }
      }

      const nextRunAt = computeNextRunAt(
        new Date(plan.next_run_at),
        plan.timezone,
        plan.frequency,
        plan.custom_interval_days,
        plan.send_hour,
        plan.send_minute
      );
      await supabase
        .from('recurring_payment_plans')
        .update({ next_run_at: nextRunAt.toISOString(), processing_locked_until: null })
        .eq('id', plan.id);
      await recordPlanAttempt(supabase, plan.id, true);

      generated++;
    } catch (error) {
      console.error(`process-recurring-plans: error processing plan ${plan.id}`, error);
      // Leave processing_locked_until as claim_due_recurring_plans set it --
      // it expires on its own after 5 minutes, at which point this plan
      // becomes reclaimable again on a later tick. No retry counter here
      // (unlike reminders): a recurring plan has no bounded "give up after
      // N attempts" concept in the spec -- it should simply keep trying on
      // its normal schedule. consecutive_failures (Phase 5C) is a pure
      // observability counter, not a cutoff -- it never stops this plan
      // from being reclaimed and retried on the next tick.
      await recordPlanAttempt(supabase, plan.id, false, 'generation_error');
      failed++;
    }
  }

  await recordRun(supabase, runStartedAt, plans.length, generated, skipped, failed);
  return json({ ok: true, claimed: plans.length, generated, skipped, failed });
});

// --- Deployment (cannot be done from here -- no Supabase CLI/dashboard
// access in this environment) -----------------------------------------
//
// 1. Deploy: `supabase functions deploy process-recurring-plans`
// 2. Set the secret: RECURRING_CRON_SECRET -- any long random string,
//    independent of process-reminders' own REMINDER_CRON_SECRET.
// 3. Schedule it (every 15-60 minutes is plenty -- a recurring plan's own
//    granularity is at best daily): via the Supabase dashboard's Cron Jobs
//    UI (Invoke an Edge Function -> process-recurring-plans, with header
//    `x-cron-secret: <RECURRING_CRON_SECRET>`), or via pg_cron + pg_net:
//      select cron.schedule(
//        'process-recurring-plans-hourly',
//        '0 * * * *',
//        $$
//        select net.http_post(
//          url := 'https://<project-ref>.supabase.co/functions/v1/process-recurring-plans',
//          headers := jsonb_build_object(
//            'Content-Type', 'application/json',
//            'x-cron-secret', '<RECURRING_CRON_SECRET>'
//          ),
//          body := '{}'::jsonb
//        );
//        $$
//      );
