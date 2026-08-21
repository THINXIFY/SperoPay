jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useRequestEventStore } from '../requestEventStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useRequestEventStore.setState({ events: [], status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads and maps rows to the RequestEvent shape', async () => {
    const builder = makeQueryBuilder({
      data: [{ id: 'e1', payment_request_id: 'r1', event_type: 'created', occurred_at: '2026-08-21T00:00:00.000Z' }],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useRequestEventStore.getState().loadForUser('user-1');

    expect(useRequestEventStore.getState().events).toEqual([
      { id: 'e1', requestId: 'r1', type: 'created', occurredAt: '2026-08-21T00:00:00.000Z' },
    ]);
    expect(useRequestEventStore.getState().status).toBe('loaded');
  });

  it('sets a calm error on failure', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('boom') });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useRequestEventStore.getState().loadForUser('user-1');

    expect(useRequestEventStore.getState().status).toBe('error');
  });
});

describe('getEventsForRequest', () => {
  it('filters and sorts by occurredAt ascending', () => {
    useRequestEventStore.setState({
      events: [
        { id: 'e2', requestId: 'r1', type: 'payment_confirmed', occurredAt: '2026-08-21T02:00:00.000Z' },
        { id: 'e1', requestId: 'r1', type: 'created', occurredAt: '2026-08-21T01:00:00.000Z' },
        { id: 'e3', requestId: 'r2', type: 'created', occurredAt: '2026-08-21T00:00:00.000Z' },
      ],
      status: 'loaded',
      error: null,
    });

    const events = useRequestEventStore.getState().getEventsForRequest('r1');

    expect(events.map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});

describe('reset', () => {
  it('clears events back to idle', () => {
    useRequestEventStore.setState({
      events: [{ id: 'e1', requestId: 'r1', type: 'created', occurredAt: '2026-08-21T00:00:00.000Z' }],
      status: 'loaded',
      error: null,
    });
    useRequestEventStore.getState().reset();
    expect(useRequestEventStore.getState().events).toEqual([]);
    expect(useRequestEventStore.getState().status).toBe('idle');
  });
});
