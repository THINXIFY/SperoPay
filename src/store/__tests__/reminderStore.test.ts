jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useReminderStore } from '../reminderStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.insert = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.upsert = jest.fn(chain);
  builder.delete = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  (builder as unknown as { then: typeof Promise.prototype.then }).then = (onFulfilled) =>
    Promise.resolve(result).then(onFulfilled as never);
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useReminderStore.setState({
    schedulesByRequest: {},
    remindersByRequest: {},
    remindersAll: [],
    status: 'idle',
    allStatus: 'idle',
    error: null,
  });
});

describe('loadForRequest', () => {
  it('loads and maps both the schedule and the reminders for one request', async () => {
    const scheduleBuilder = makeQueryBuilder({
      data: {
        id: 'sched-1',
        payment_request_id: 'req-1',
        enabled: true,
        preset: 'standard',
        custom_rules: null,
        send_hour: 10,
        send_minute: 0,
        timezone: 'Asia/Karachi',
      },
      error: null,
    });
    const remindersBuilder = makeQueryBuilder({
      data: [
        {
          id: 'rem-1',
          payment_request_id: 'req-1',
          schedule_id: 'sched-1',
          reminder_type: 'on_due',
          offset_value: 0,
          offset_unit: 'days',
          scheduled_for: '2026-09-10T05:00:00.000Z',
          status: 'scheduled',
          delivery_channel: null,
          sent_at: null,
          attempt_count: 0,
          last_error: null,
        },
      ],
      error: null,
    });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'payment_reminder_schedules' ? scheduleBuilder : remindersBuilder) as never
    );

    await useReminderStore.getState().loadForRequest('req-1');

    const state = useReminderStore.getState();
    expect(state.status).toBe('loaded');
    expect(state.schedulesByRequest['req-1']?.preset).toBe('standard');
    expect(state.schedulesByRequest['req-1']?.timezone).toBe('Asia/Karachi');
    expect(state.remindersByRequest['req-1']).toHaveLength(1);
    expect(state.remindersByRequest['req-1']?.[0].reminderType).toBe('on_due');
  });

  it('leaves the schedule undefined when none exists yet (a request with reminders never configured)', async () => {
    const scheduleBuilder = makeQueryBuilder({ data: null, error: null });
    const remindersBuilder = makeQueryBuilder({ data: [], error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'payment_reminder_schedules' ? scheduleBuilder : remindersBuilder) as never
    );

    await useReminderStore.getState().loadForRequest('req-2');

    expect(useReminderStore.getState().schedulesByRequest['req-2']).toBeUndefined();
    expect(useReminderStore.getState().remindersByRequest['req-2']).toEqual([]);
  });
});

describe('saveSchedule', () => {
  it('upserts the schedule, clears stale scheduled reminders, and inserts fresh future occurrences', async () => {
    const scheduleBuilder = makeQueryBuilder({
      data: {
        id: 'sched-1',
        payment_request_id: 'req-1',
        enabled: true,
        preset: 'standard',
        custom_rules: null,
        send_hour: 10,
        send_minute: 0,
        timezone: 'UTC',
      },
      error: null,
    });
    const remindersBuilder = makeQueryBuilder({ data: [], error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'payment_reminder_schedules' ? scheduleBuilder : remindersBuilder) as never
    );

    const farFutureDueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(); // 1 year out -- every occurrence is guaranteed still in the future
    await useReminderStore.getState().saveSchedule('user-1', 'req-1', {
      enabled: true,
      preset: 'standard',
      sendHour: 10,
      sendMinute: 0,
      timezone: 'UTC',
      dueAt: farFutureDueDate,
    });

    expect(scheduleBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', payment_request_id: 'req-1', enabled: true, preset: 'standard' }),
      { onConflict: 'payment_request_id' }
    );
    expect(remindersBuilder.delete).toHaveBeenCalled();
    // Standard preset has 4 rules -- all in the future relative to a due
    // date a year out.
    expect(remindersBuilder.insert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ schedule_id: 'sched-1', payment_request_id: 'req-1' })])
    );
    const insertedRows = remindersBuilder.insert.mock.calls[0][0];
    expect(insertedRows).toHaveLength(4);
  });

  it('never inserts an occurrence that has already passed', async () => {
    const scheduleBuilder = makeQueryBuilder({
      data: {
        id: 'sched-1',
        payment_request_id: 'req-1',
        enabled: true,
        preset: 'gentle',
        custom_rules: null,
        send_hour: 10,
        send_minute: 0,
        timezone: 'UTC',
      },
      error: null,
    });
    const remindersBuilder = makeQueryBuilder({ data: [], error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'payment_reminder_schedules' ? scheduleBuilder : remindersBuilder) as never
    );

    // Due date in the past -- both gentle-preset occurrences (on_due,
    // 5 days overdue) would compute to instants already behind us.
    const pastDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    await useReminderStore.getState().saveSchedule('user-1', 'req-1', {
      enabled: true,
      preset: 'gentle',
      sendHour: 10,
      sendMinute: 0,
      timezone: 'UTC',
      dueAt: pastDueDate,
    });

    // insert is never called at all when there's nothing left to schedule.
    expect(remindersBuilder.insert).not.toHaveBeenCalled();
  });

  it('does not compute or insert any occurrences when the schedule is disabled', async () => {
    const scheduleBuilder = makeQueryBuilder({
      data: {
        id: 'sched-1',
        payment_request_id: 'req-1',
        enabled: false,
        preset: 'standard',
        custom_rules: null,
        send_hour: 10,
        send_minute: 0,
        timezone: 'UTC',
      },
      error: null,
    });
    const remindersBuilder = makeQueryBuilder({ data: [], error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'payment_reminder_schedules' ? scheduleBuilder : remindersBuilder) as never
    );

    const farFutureDueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
    await useReminderStore.getState().saveSchedule('user-1', 'req-1', {
      enabled: false,
      preset: 'standard',
      sendHour: 10,
      sendMinute: 0,
      timezone: 'UTC',
      dueAt: farFutureDueDate,
    });

    expect(remindersBuilder.insert).not.toHaveBeenCalled();
    // Still clears any previously-scheduled rows from before it was turned off.
    expect(remindersBuilder.delete).toHaveBeenCalled();
  });

  it('stores custom_rules only for the custom preset, null otherwise', async () => {
    const scheduleBuilder = makeQueryBuilder({
      data: {
        id: 'sched-1',
        payment_request_id: 'req-1',
        enabled: true,
        preset: 'custom',
        custom_rules: [{ type: 'after_due', offsetValue: 10, offsetUnit: 'days' }],
        send_hour: 10,
        send_minute: 0,
        timezone: 'UTC',
      },
      error: null,
    });
    const remindersBuilder = makeQueryBuilder({ data: [], error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'payment_reminder_schedules' ? scheduleBuilder : remindersBuilder) as never
    );

    const farFutureDueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
    await useReminderStore.getState().saveSchedule('user-1', 'req-1', {
      enabled: true,
      preset: 'custom',
      customRules: [{ type: 'after_due', offsetValue: 10, offsetUnit: 'days' }],
      sendHour: 10,
      sendMinute: 0,
      timezone: 'UTC',
      dueAt: farFutureDueDate,
    });

    expect(scheduleBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ custom_rules: [{ type: 'after_due', offsetValue: 10, offsetUnit: 'days' }] }),
      expect.anything()
    );
  });
});

describe('disableSchedule', () => {
  it('marks the schedule disabled and cancels still-scheduled reminders', async () => {
    const scheduleBuilder = makeQueryBuilder({ data: null, error: null });
    const remindersBuilder = makeQueryBuilder({ data: [], error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      (table === 'payment_reminder_schedules' ? scheduleBuilder : remindersBuilder) as never
    );

    await useReminderStore.getState().disableSchedule('user-1', 'req-1');

    expect(scheduleBuilder.update).toHaveBeenCalledWith({ enabled: false });
    expect(remindersBuilder.update).toHaveBeenCalledWith({ status: 'cancelled' });
  });
});

describe('recordManualSend', () => {
  it('inserts a completed (already-sent) history row for a manual send', async () => {
    const builder = makeQueryBuilder({
      data: {
        id: 'rem-manual-1',
        payment_request_id: 'req-1',
        schedule_id: null,
        reminder_type: 'manual',
        offset_value: 0,
        offset_unit: 'days',
        scheduled_for: '2026-09-10T10:00:00.000Z',
        status: 'sent',
        delivery_channel: 'whatsapp',
        sent_at: '2026-09-10T10:00:00.000Z',
        attempt_count: 1,
        last_error: null,
      },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    const reminder = await useReminderStore.getState().recordManualSend('user-1', 'req-1', 'whatsapp');

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ reminder_type: 'manual', status: 'sent', delivery_channel: 'whatsapp' })
    );
    expect(reminder.status).toBe('sent');
    expect(useReminderStore.getState().remindersByRequest['req-1']).toContainEqual(reminder);
  });
});

describe('loadAllForUser', () => {
  it('loads every reminder for the user, across all requests, for Automation Overview', async () => {
    const builder = makeQueryBuilder({
      data: [
        {
          id: 'rem-1',
          payment_request_id: 'req-1',
          schedule_id: 'sch-1',
          reminder_type: 'before_due',
          offset_value: 2,
          offset_unit: 'days',
          scheduled_for: '2026-09-10T10:00:00.000Z',
          status: 'scheduled',
          delivery_channel: null,
          sent_at: null,
          attempt_count: 0,
          last_error: null,
        },
        {
          id: 'rem-2',
          payment_request_id: 'req-2',
          schedule_id: 'sch-2',
          reminder_type: 'on_due',
          offset_value: 0,
          offset_unit: 'days',
          scheduled_for: '2026-09-08T10:00:00.000Z',
          status: 'failed',
          delivery_channel: null,
          sent_at: null,
          attempt_count: 3,
          last_error: 'processing_error',
        },
      ],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useReminderStore.getState().loadAllForUser('user-1');

    const state = useReminderStore.getState();
    expect(state.allStatus).toBe('loaded');
    expect(state.remindersAll).toHaveLength(2);
    expect(state.remindersAll.map((r) => r.paymentRequestId)).toEqual(['req-1', 'req-2']);
    expect(state.remindersAll[1].status).toBe('failed');
  });

  it('reports an error status without touching the per-request maps', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'network down' } });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useReminderStore.getState().loadAllForUser('user-1');

    expect(useReminderStore.getState().allStatus).toBe('error');
  });
});
