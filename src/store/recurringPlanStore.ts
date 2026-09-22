import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { createStaleGuard } from './staleGuard';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import { computeNextRunAt } from '../utils/recurringSchedule';
import { zonedTimeToUtc, getZonedDateParts } from '../utils/reminderSchedule';
import { DEFAULT_ASSET, type AssetSymbol } from '../config/assets';
import type { RecurringPlan, RecurringFrequency, DepositType, ReminderPreset, ReminderRule } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

export interface RecurringPlanInput {
  customerId?: string;
  amount: number;
  // Defaults to DEFAULT_ASSET (USDC) when omitted. Permanent for this plan
  // once created -- see src/types/recurring.ts's own comment.
  currency?: AssetSymbol;
  description?: string;
  note?: string;
  frequency: RecurringFrequency;
  customIntervalDays?: number;
  dueDateOffsetDays?: number;
  // "YYYY-MM-DD" in the plan's own timezone -- the very first occurrence's
  // calendar date. next_run_at for a brand-new plan is this date at
  // sendHour:sendMinute, resolved in `timezone` (see zonedTimeToUtc).
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  timezone: string;
  sendHour: number;
  sendMinute: number;
  allowPartialPayments?: boolean;
  depositType?: DepositType;
  depositValue?: number;
  remindersEnabled?: boolean;
  reminderPreset?: ReminderPreset;
  reminderCustomRules?: ReminderRule[];
  sourceTemplateId?: string;
}

interface RecurringPlanState {
  plans: RecurringPlan[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  createPlan: (userId: string, input: RecurringPlanInput) => Promise<RecurringPlan>;
  pausePlan: (userId: string, planId: string) => Promise<void>;
  resumePlan: (userId: string, planId: string) => Promise<void>;
  endPlan: (userId: string, planId: string) => Promise<void>;
  reset: () => void;
}

const guard = createStaleGuard();

interface RecurringPlanRow {
  id: string;
  customer_id: string | null;
  amount: string | number;
  currency: RecurringPlan['currency'];
  network: RecurringPlan['network'];
  description: string | null;
  note: string | null;
  frequency: RecurringFrequency;
  custom_interval_days: number | null;
  due_date_offset_days: number | null;
  start_date: string;
  end_date: string | null;
  max_occurrences: number | null;
  occurrences_generated: number;
  next_run_at: string;
  send_hour: number;
  send_minute: number;
  timezone: string;
  active: boolean;
  allow_partial_payments: boolean;
  deposit_type: DepositType | null;
  deposit_value: string | number | null;
  reminders_enabled: boolean;
  reminder_preset: ReminderPreset;
  reminder_custom_rules: ReminderRule[] | null;
  source_template_id: string | null;
  created_at: string;
  consecutive_failures: number;
  last_error: string | null;
  last_attempted_at: string | null;
}

function mapRow(row: RecurringPlanRow): RecurringPlan {
  return {
    id: row.id,
    customerId: row.customer_id ?? undefined,
    amount: Number(row.amount),
    currency: row.currency,
    network: row.network,
    description: row.description ?? undefined,
    note: row.note ?? undefined,
    frequency: row.frequency,
    customIntervalDays: row.custom_interval_days ?? undefined,
    dueDateOffsetDays: row.due_date_offset_days ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    maxOccurrences: row.max_occurrences ?? undefined,
    occurrencesGenerated: row.occurrences_generated,
    nextRunAt: row.next_run_at,
    sendHour: row.send_hour,
    sendMinute: row.send_minute,
    timezone: row.timezone,
    active: row.active,
    allowPartialPayments: row.allow_partial_payments,
    depositType: row.deposit_type ?? undefined,
    depositValue: row.deposit_value != null ? Number(row.deposit_value) : undefined,
    remindersEnabled: row.reminders_enabled,
    reminderPreset: row.reminder_preset,
    reminderCustomRules: row.reminder_custom_rules ?? undefined,
    sourceTemplateId: row.source_template_id ?? undefined,
    createdAt: row.created_at,
    consecutiveFailures: row.consecutive_failures,
    lastError: row.last_error ?? undefined,
    lastAttemptedAt: row.last_attempted_at ?? undefined,
  };
}

function parseStartDate(startDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = startDate.split('-').map(Number);
  return { year, month, day };
}

export const useRecurringPlanStore = create<RecurringPlanState>()((set, get) => ({
  plans: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    const token = guard.next();
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('recurring_payment_plans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!guard.isCurrent(token)) return;
      set({ plans: ((data ?? []) as RecurringPlanRow[]).map(mapRow), status: 'loaded' });
    } catch (error) {
      if (!guard.isCurrent(token)) return;
      set({ status: 'error', error: getDataErrorMessage(error, 'requests') });
    }
  },

  createPlan: async (userId, input) => {
    guard.next();
    const { year, month, day } = parseStartDate(input.startDate);
    const firstRunAt = zonedTimeToUtc(year, month, day, input.sendHour, input.sendMinute, input.timezone);
    try {
      const { data, error } = await supabase
        .from('recurring_payment_plans')
        .insert({
          user_id: userId,
          customer_id: input.customerId ?? null,
          amount: input.amount,
          currency: input.currency ?? DEFAULT_ASSET,
          description: input.description ?? null,
          note: input.note ?? null,
          frequency: input.frequency,
          custom_interval_days: input.frequency === 'custom' ? (input.customIntervalDays ?? 1) : null,
          due_date_offset_days: input.dueDateOffsetDays ?? null,
          start_date: input.startDate,
          end_date: input.endDate ?? null,
          max_occurrences: input.maxOccurrences ?? null,
          next_run_at: firstRunAt.toISOString(),
          send_hour: input.sendHour,
          send_minute: input.sendMinute,
          timezone: input.timezone,
          allow_partial_payments: input.allowPartialPayments ?? false,
          deposit_type: input.depositType ?? null,
          deposit_value: input.depositValue ?? null,
          reminders_enabled: input.remindersEnabled ?? false,
          reminder_preset: input.reminderPreset ?? 'standard',
          reminder_custom_rules: input.reminderPreset === 'custom' ? (input.reminderCustomRules ?? []) : null,
          source_template_id: input.sourceTemplateId ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      const plan = mapRow(data as RecurringPlanRow);
      set((state) => ({ plans: [plan, ...state.plans] }));
      return plan;
    } catch (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
  },

  pausePlan: async (userId, planId) => {
    guard.next();
    try {
      const { error } = await supabase
        .from('recurring_payment_plans')
        .update({ active: false })
        .eq('id', planId)
        .eq('user_id', userId);
      if (error) throw error;
      set((state) => ({ plans: state.plans.map((p) => (p.id === planId ? { ...p, active: false } : p)) }));
    } catch (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
  },

  // Resuming recomputes next_run_at from *now* (in the plan's own
  // timezone), not from whatever stale next_run_at it had when paused --
  // otherwise a plan paused for two months would immediately try to
  // "catch up" by generating every occurrence it missed the instant it's
  // resumed, which is never the intended behavior for a paused-then-
  // resumed billing schedule.
  resumePlan: async (userId, planId) => {
    guard.next();
    const plan = get().plans.find((p) => p.id === planId);
    if (!plan) return;
    const now = new Date();
    const todayParts = getZonedDateParts(now, plan.timezone);
    const todayAtSendTime = zonedTimeToUtc(todayParts.year, todayParts.month, todayParts.day, plan.sendHour, plan.sendMinute, plan.timezone);
    // If today's send time hasn't passed yet, resume there; otherwise the
    // next full interval from today. Never computed from the plan's old,
    // possibly months-stale next_run_at -- a paused plan must not "catch
    // up" by generating everything it missed the instant it's resumed.
    const next = todayAtSendTime.getTime() > now.getTime()
      ? todayAtSendTime
      : computeNextRunAt(todayAtSendTime, plan.timezone, plan.frequency, plan.customIntervalDays, plan.sendHour, plan.sendMinute);
    try {
      const { error } = await supabase
        .from('recurring_payment_plans')
        .update({ active: true, next_run_at: next.toISOString() })
        .eq('id', planId)
        .eq('user_id', userId);
      if (error) throw error;
      set((state) => ({
        plans: state.plans.map((p) => (p.id === planId ? { ...p, active: true, nextRunAt: next.toISOString() } : p)),
      }));
    } catch (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
  },

  endPlan: async (userId, planId) => {
    guard.next();
    try {
      const { error } = await supabase
        .from('recurring_payment_plans')
        .update({ active: false, end_date: new Date().toISOString().slice(0, 10) })
        .eq('id', planId)
        .eq('user_id', userId);
      if (error) throw error;
      set((state) => ({ plans: state.plans.filter((p) => p.id !== planId) }));
    } catch (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
  },

  reset: () => {
    guard.next();
    set({ plans: [], status: 'idle', error: null });
  },
}));

registerResettable(() => useRecurringPlanStore.getState().reset());
