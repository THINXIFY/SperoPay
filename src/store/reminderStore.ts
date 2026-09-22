import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { computeReminderOccurrences, rulesForPreset } from '../utils/reminderSchedule';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Reminder, ReminderPreset, ReminderRule, ReminderSchedule, ReminderStatus, ReminderType } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

export interface SaveScheduleInput {
  enabled: boolean;
  preset: ReminderPreset;
  customRules?: ReminderRule[];
  sendHour: number;
  sendMinute: number;
  timezone: string;
  dueAt: string; // required to (re)compute occurrences -- see the store's own guard below
}

interface ReminderState {
  // Keyed by payment_request_id -- Request Detail only ever needs the one
  // request it's showing, never a global list (see spec's performance
  // section: no reason to load every reminder across every request).
  schedulesByRequest: Record<string, ReminderSchedule | undefined>;
  remindersByRequest: Record<string, Reminder[] | undefined>;
  status: Status;
  error: string | null;
  // Phase 5C: Automation Overview is the one genuine exception to the "never
  // a global list" rule above -- it needs "how many reminders are scheduled/
  // failed across every request" as plain counts, which the per-request map
  // above cannot answer without loading every request's reminders
  // individually. A separate array + its own status, so a screen that only
  // ever needs one request's reminders (Request Detail) never pays for this.
  remindersAll: Reminder[];
  allStatus: Status;
  loadForRequest: (requestId: string) => Promise<void>;
  loadAllForUser: (userId: string) => Promise<void>;
  // Creates or replaces the request's schedule and recomputes its future
  // occurrences from scratch. Any reminder rows already 'sent' or
  // 'cancelled' are left untouched (real history, never rewritten); only
  // still-'scheduled' rows for this request are cleared and replaced.
  saveSchedule: (userId: string, requestId: string, input: SaveScheduleInput) => Promise<void>;
  disableSchedule: (userId: string, requestId: string) => Promise<void>;
  // Records a manual send (Share/WhatsApp/copy) as a completed history
  // row -- see app/(app)/requests/[id].tsx. deliveryChannel is whichever
  // action the merchant actually took ('share' | 'whatsapp' | 'copy_message' | 'copy_link').
  recordManualSend: (userId: string, requestId: string, deliveryChannel: string) => Promise<Reminder>;
  reset: () => void;
}

function mapScheduleRow(row: {
  id: string;
  payment_request_id: string;
  enabled: boolean;
  preset: ReminderPreset;
  custom_rules: ReminderRule[] | null;
  send_hour: number;
  send_minute: number;
  timezone: string;
}): ReminderSchedule {
  return {
    id: row.id,
    paymentRequestId: row.payment_request_id,
    enabled: row.enabled,
    preset: row.preset,
    customRules: row.custom_rules ?? undefined,
    sendHour: row.send_hour,
    sendMinute: row.send_minute,
    timezone: row.timezone,
  };
}

function mapReminderRow(row: {
  id: string;
  payment_request_id: string;
  schedule_id: string | null;
  reminder_type: ReminderType;
  offset_value: number;
  offset_unit: 'days' | 'weeks';
  scheduled_for: string;
  status: ReminderStatus;
  delivery_channel: string | null;
  sent_at: string | null;
  attempt_count: number;
  last_error: string | null;
}): Reminder {
  return {
    id: row.id,
    paymentRequestId: row.payment_request_id,
    scheduleId: row.schedule_id ?? undefined,
    reminderType: row.reminder_type,
    offsetValue: row.offset_value,
    offsetUnit: row.offset_unit,
    scheduledFor: row.scheduled_for,
    status: row.status,
    deliveryChannel: row.delivery_channel ?? undefined,
    sentAt: row.sent_at ?? undefined,
    attemptCount: row.attempt_count,
    lastError: row.last_error ?? undefined,
  };
}

export const useReminderStore = create<ReminderState>()((set, get) => ({
  schedulesByRequest: {},
  remindersByRequest: {},
  remindersAll: [],
  status: 'idle',
  allStatus: 'idle',
  error: null,

  loadAllForUser: async (userId) => {
    set({ allStatus: 'loading' });
    try {
      const { data, error } = await supabase
        .from('payment_reminders')
        .select('*')
        .eq('user_id', userId)
        .order('scheduled_for', { ascending: true });
      if (error) throw error;
      set({ remindersAll: (data ?? []).map(mapReminderRow), allStatus: 'loaded' });
    } catch (error) {
      set({ allStatus: 'error', error: getDataErrorMessage(error, 'requests') });
    }
  },

  loadForRequest: async (requestId) => {
    set({ status: 'loading', error: null });
    try {
      const [scheduleResult, remindersResult] = await Promise.all([
        supabase.from('payment_reminder_schedules').select('*').eq('payment_request_id', requestId).maybeSingle(),
        supabase
          .from('payment_reminders')
          .select('*')
          .eq('payment_request_id', requestId)
          .order('scheduled_for', { ascending: true }),
      ]);
      if (scheduleResult.error) throw scheduleResult.error;
      if (remindersResult.error) throw remindersResult.error;
      set((state) => ({
        schedulesByRequest: {
          ...state.schedulesByRequest,
          [requestId]: scheduleResult.data ? mapScheduleRow(scheduleResult.data) : undefined,
        },
        remindersByRequest: {
          ...state.remindersByRequest,
          [requestId]: (remindersResult.data ?? []).map(mapReminderRow),
        },
        status: 'loaded',
      }));
    } catch (error) {
      set({ status: 'error', error: getDataErrorMessage(error, 'requests') });
    }
  },

  saveSchedule: async (userId, requestId, input) => {
    try {
      const { data: scheduleRow, error: scheduleError } = await supabase
        .from('payment_reminder_schedules')
        .upsert(
          {
            user_id: userId,
            payment_request_id: requestId,
            enabled: input.enabled,
            preset: input.preset,
            custom_rules: input.preset === 'custom' ? (input.customRules ?? []) : null,
            send_hour: input.sendHour,
            send_minute: input.sendMinute,
            timezone: input.timezone,
          },
          { onConflict: 'payment_request_id' }
        )
        .select('*')
        .single();
      if (scheduleError) throw scheduleError;
      const schedule = mapScheduleRow(scheduleRow);

      // Clear out not-yet-fired occurrences from any previous save (a
      // changed preset/time must not leave stale rows from the old one
      // sitting alongside the new ones) -- sent/cancelled/failed/skipped
      // rows are real history and are never touched.
      const { error: clearError } = await supabase
        .from('payment_reminders')
        .delete()
        .eq('payment_request_id', requestId)
        .eq('status', 'scheduled');
      if (clearError) throw clearError;

      if (input.enabled) {
        const rules = rulesForPreset(input.preset, input.customRules);
        const occurrences = computeReminderOccurrences(
          new Date(input.dueAt),
          rules,
          input.sendHour,
          input.sendMinute,
          input.timezone
        ).filter((occurrence) => occurrence.scheduledFor.getTime() > Date.now()); // never schedule one already in the past

        if (occurrences.length > 0) {
          const { error: insertError } = await supabase.from('payment_reminders').insert(
            occurrences.map((occurrence) => ({
              user_id: userId,
              payment_request_id: requestId,
              schedule_id: schedule.id,
              reminder_type: occurrence.rule.type,
              offset_value: occurrence.rule.offsetValue,
              offset_unit: occurrence.rule.offsetUnit,
              scheduled_for: occurrence.scheduledFor.toISOString(),
            }))
          );
          if (insertError) throw insertError;
        }
      }

      await get().loadForRequest(requestId);
    } catch (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
  },

  disableSchedule: async (userId, requestId) => {
    try {
      const { error: updateError } = await supabase
        .from('payment_reminder_schedules')
        .update({ enabled: false })
        .eq('payment_request_id', requestId)
        .eq('user_id', userId);
      if (updateError) throw updateError;
      const { error: cancelError } = await supabase
        .from('payment_reminders')
        .update({ status: 'cancelled' })
        .eq('payment_request_id', requestId)
        .eq('status', 'scheduled');
      if (cancelError) throw cancelError;
      await get().loadForRequest(requestId);
    } catch (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
  },

  recordManualSend: async (userId, requestId, deliveryChannel) => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('payment_reminders')
      .insert({
        user_id: userId,
        payment_request_id: requestId,
        reminder_type: 'manual',
        offset_value: 0,
        offset_unit: 'days',
        scheduled_for: nowIso,
        status: 'sent',
        delivery_channel: deliveryChannel,
        sent_at: nowIso,
        attempt_count: 1,
      })
      .select('*')
      .single();
    if (error) throw error;
    const reminder = mapReminderRow(data);
    set((state) => ({
      remindersByRequest: {
        ...state.remindersByRequest,
        [requestId]: [...(state.remindersByRequest[requestId] ?? []), reminder],
      },
    }));
    return reminder;
  },

  reset: () => {
    set({ schedulesByRequest: {}, remindersByRequest: {}, remindersAll: [], status: 'idle', allStatus: 'idle', error: null });
  },
}));

registerResettable(() => useReminderStore.getState().reset());
