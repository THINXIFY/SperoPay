jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useRecurringPlanStore } from '../recurringPlanStore';
import { zonedTimeToUtc } from '../../utils/reminderSchedule';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.insert = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.delete = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  (builder as unknown as { then: typeof Promise.prototype.then }).then = (onFulfilled) =>
    Promise.resolve(result).then(onFulfilled as never);
  return builder;
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    customer_id: 'cust-1',
    amount: 500,
    currency: 'USDC',
    network: 'Solana',
    description: 'Website Maintenance',
    note: null,
    frequency: 'monthly',
    custom_interval_days: null,
    due_date_offset_days: 7,
    start_date: '2026-09-10',
    end_date: null,
    max_occurrences: null,
    occurrences_generated: 0,
    next_run_at: '2026-09-10T09:00:00.000Z',
    send_hour: 9,
    send_minute: 0,
    timezone: 'UTC',
    active: true,
    allow_partial_payments: false,
    deposit_type: null,
    deposit_value: null,
    reminders_enabled: true,
    reminder_preset: 'standard',
    reminder_custom_rules: null,
    source_template_id: null,
    created_at: '2026-09-01T00:00:00.000Z',
    consecutive_failures: 0,
    last_error: null,
    last_attempted_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useRecurringPlanStore.setState({ plans: [], status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads and maps plans for the given user', async () => {
    const builder = makeQueryBuilder({ data: [makeRow()], error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useRecurringPlanStore.getState().loadForUser('user-1');

    const state = useRecurringPlanStore.getState();
    expect(state.status).toBe('loaded');
    expect(state.plans).toHaveLength(1);
    expect(state.plans[0].frequency).toBe('monthly');
    expect(state.plans[0].amount).toBe(500);
  });
});

describe('createPlan', () => {
  it('computes next_run_at from the start date at the configured send time, in UTC', async () => {
    const builder = makeQueryBuilder({ data: makeRow(), error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useRecurringPlanStore.getState().createPlan('user-1', {
      amount: 500,
      frequency: 'monthly',
      startDate: '2026-09-10',
      timezone: 'UTC',
      sendHour: 9,
      sendMinute: 0,
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        amount: 500,
        frequency: 'monthly',
        next_run_at: zonedTimeToUtc(2026, 9, 10, 9, 0, 'UTC').toISOString(),
      })
    );
  });

  // Phase 7: `500 EURC monthly` -- the plan must persist EURC when given,
  // not silently default to USDC, and must keep generating EURC requests
  // (see generate_recurring_request in the Phase 7 migration, which threads
  // v_plan.currency through unchanged) regardless of the business's current
  // default currency.
  it('persists an explicit EURC currency, not the USDC default', async () => {
    const builder = makeQueryBuilder({ data: makeRow({ currency: 'EURC' }), error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    const plan = await useRecurringPlanStore.getState().createPlan('user-1', {
      amount: 500,
      currency: 'EURC',
      frequency: 'monthly',
      startDate: '2026-09-10',
      timezone: 'UTC',
      sendHour: 9,
      sendMinute: 0,
    });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ currency: 'EURC' }));
    expect(plan.currency).toBe('EURC');
  });

  it('defaults to USDC when no currency is given', async () => {
    const builder = makeQueryBuilder({ data: makeRow(), error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useRecurringPlanStore.getState().createPlan('user-1', {
      amount: 500,
      frequency: 'monthly',
      startDate: '2026-09-10',
      timezone: 'UTC',
      sendHour: 9,
      sendMinute: 0,
    });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USDC' }));
  });

  it('resolves the start date in a real IANA timezone, not UTC', async () => {
    const builder = makeQueryBuilder({ data: makeRow(), error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useRecurringPlanStore.getState().createPlan('user-1', {
      amount: 500,
      frequency: 'weekly',
      startDate: '2026-09-10',
      timezone: 'Asia/Karachi',
      sendHour: 9,
      sendMinute: 0,
    });

    const insertedRow = builder.insert.mock.calls[0][0];
    expect(insertedRow.next_run_at).toBe(zonedTimeToUtc(2026, 9, 10, 9, 0, 'Asia/Karachi').toISOString());
    expect(insertedRow.next_run_at).not.toBe(zonedTimeToUtc(2026, 9, 10, 9, 0, 'UTC').toISOString());
  });

  it('stores custom_interval_days only for the custom frequency', async () => {
    const builder = makeQueryBuilder({ data: makeRow({ frequency: 'weekly', custom_interval_days: null }), error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useRecurringPlanStore.getState().createPlan('user-1', {
      amount: 500,
      frequency: 'weekly',
      customIntervalDays: 45,
      startDate: '2026-09-10',
      timezone: 'UTC',
      sendHour: 9,
      sendMinute: 0,
    });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ custom_interval_days: null }));
  });

  it('adds the newly created plan to the front of the list', async () => {
    const builder = makeQueryBuilder({ data: makeRow({ id: 'plan-2' }), error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    const plan = await useRecurringPlanStore.getState().createPlan('user-1', {
      amount: 500,
      frequency: 'monthly',
      startDate: '2026-09-10',
      timezone: 'UTC',
      sendHour: 9,
      sendMinute: 0,
    });

    expect(plan.id).toBe('plan-2');
    expect(useRecurringPlanStore.getState().plans[0].id).toBe('plan-2');
  });
});

describe('pausePlan', () => {
  it('sets active to false locally and server-side', async () => {
    useRecurringPlanStore.setState({ plans: [{ ...mapDefaults(), id: 'plan-1', active: true }], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useRecurringPlanStore.getState().pausePlan('user-1', 'plan-1');

    expect(builder.update).toHaveBeenCalledWith({ active: false });
    expect(useRecurringPlanStore.getState().plans[0].active).toBe(false);
  });
});

describe('endPlan', () => {
  it('removes the plan from the local list after ending it server-side', async () => {
    useRecurringPlanStore.setState({ plans: [{ ...mapDefaults(), id: 'plan-1' }], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useRecurringPlanStore.getState().endPlan('user-1', 'plan-1');

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
    expect(useRecurringPlanStore.getState().plans).toHaveLength(0);
  });
});

describe('resumePlan', () => {
  it('never generates using a stale, months-old next_run_at -- recomputes from now instead', async () => {
    const staleNextRunAt = '2026-01-01T09:00:00.000Z';
    useRecurringPlanStore.setState({
      plans: [{ ...mapDefaults(), id: 'plan-1', active: false, nextRunAt: staleNextRunAt, frequency: 'monthly', timezone: 'UTC', sendHour: 9, sendMinute: 0 }],
      status: 'loaded',
      error: null,
    });
    const builder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useRecurringPlanStore.getState().resumePlan('user-1', 'plan-1');

    const updatedRow = builder.update.mock.calls[0][0];
    expect(updatedRow.active).toBe(true);
    expect(updatedRow.next_run_at).not.toBe(staleNextRunAt);
    expect(new Date(updatedRow.next_run_at).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});

// A minimal, fully-populated RecurringPlan for store-state seeding in
// tests that don't care about every field's value.
function mapDefaults() {
  return {
    id: 'plan-x',
    customerId: undefined,
    amount: 500,
    currency: 'USDC' as const,
    network: 'Solana' as const,
    description: undefined,
    note: undefined,
    frequency: 'monthly' as const,
    customIntervalDays: undefined,
    dueDateOffsetDays: undefined,
    startDate: '2026-09-10',
    endDate: undefined,
    maxOccurrences: undefined,
    occurrencesGenerated: 0,
    nextRunAt: '2026-10-10T09:00:00.000Z',
    sendHour: 9,
    sendMinute: 0,
    timezone: 'UTC',
    active: true,
    allowPartialPayments: false,
    depositType: undefined,
    depositValue: undefined,
    remindersEnabled: true,
    reminderPreset: 'standard' as const,
    reminderCustomRules: undefined,
    sourceTemplateId: undefined,
    createdAt: '2026-09-01T00:00:00.000Z',
  };
}
