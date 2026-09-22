jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useNotificationsFeedStore } from '../notificationsFeedStore';

const mockedSupabase = jest.mocked(supabase);

function makeLoadBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(chain);
  builder.limit = jest.fn(() => Promise.resolve(result));
  return builder;
}

function makeUpdateBuilder(result: { error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  let eqCalls = 0;
  builder.update = jest.fn(() => builder as never);
  builder.eq = jest.fn(() => {
    eqCalls += 1;
    // Resolves once the final `.eq()` in the chain is reached -- both
    // markAsRead (2 eq calls: id, user_id) and markAllAsRead (2 eq calls:
    // user_id, is_read) chain exactly two `.eq()`s.
    if (eqCalls === 2) return Promise.resolve(result);
    return builder as never;
  });
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useNotificationsFeedStore.setState({ notifications: [], status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads and maps a payment_received row to the AppNotification shape', async () => {
    const builder = makeLoadBuilder({
      data: [
        {
          id: 'n1',
          type: 'payment_received',
          title: 'Payment received',
          message: '250 USDC received for SP-ABCDE.',
          entity_type: 'request',
          entity_id: 'r1',
          is_read: false,
          created_at: '2026-09-08T00:00:00.000Z',
        },
      ],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useNotificationsFeedStore.getState().loadForUser('user-1');

    expect(useNotificationsFeedStore.getState().notifications).toEqual([
      {
        id: 'n1',
        type: 'payment_received',
        title: 'Payment received',
        message: '250 USDC received for SP-ABCDE.',
        entityType: 'request',
        entityId: 'r1',
        isRead: false,
        createdAt: '2026-09-08T00:00:00.000Z',
      },
    ]);
    expect(useNotificationsFeedStore.getState().status).toBe('loaded');
    expect(builder.limit).toHaveBeenCalledWith(200);
  });

  it('maps a reminder_sent row correctly', async () => {
    const builder = makeLoadBuilder({
      data: [
        {
          id: 'n2',
          type: 'reminder_sent',
          title: 'Reminder sent',
          message: 'A reminder was sent to Alex Morgan.',
          entity_type: 'request',
          entity_id: 'r2',
          is_read: true,
          created_at: '2026-09-08T00:00:00.000Z',
        },
      ],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useNotificationsFeedStore.getState().loadForUser('user-1');

    expect(useNotificationsFeedStore.getState().notifications[0].type).toBe('reminder_sent');
    expect(useNotificationsFeedStore.getState().notifications[0].isRead).toBe(true);
  });

  it('maps a recurring_generated row correctly', async () => {
    const builder = makeLoadBuilder({
      data: [
        {
          id: 'n3',
          type: 'recurring_generated',
          title: 'Recurring request generated',
          message: '400 USDC request SP-ZZZZZ was generated.',
          entity_type: 'request',
          entity_id: 'r3',
          is_read: false,
          created_at: '2026-09-08T00:00:00.000Z',
        },
      ],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useNotificationsFeedStore.getState().loadForUser('user-1');

    expect(useNotificationsFeedStore.getState().notifications[0].type).toBe('recurring_generated');
  });

  it('sets a calm error on failure', async () => {
    const builder = makeLoadBuilder({ data: null, error: new Error('boom') });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useNotificationsFeedStore.getState().loadForUser('user-1');

    expect(useNotificationsFeedStore.getState().status).toBe('error');
    expect(useNotificationsFeedStore.getState().error).not.toBeNull();
  });
});

describe('markAsRead', () => {
  it('updates the matching notification to read and leaves the rest untouched', async () => {
    useNotificationsFeedStore.setState({
      notifications: [
        { id: 'n1', type: 'payment_received', title: 'Payment received', message: null, entityType: 'request', entityId: 'r1', isRead: false, createdAt: '2026-09-08T00:00:00.000Z' },
        { id: 'n2', type: 'customer_added', title: 'Customer added', message: null, entityType: 'customer', entityId: 'c1', isRead: false, createdAt: '2026-09-08T00:00:00.000Z' },
      ],
      status: 'loaded',
      error: null,
    });
    const builder = makeUpdateBuilder({ error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useNotificationsFeedStore.getState().markAsRead('user-1', 'n1');

    const notifications = useNotificationsFeedStore.getState().notifications;
    expect(notifications.find((n) => n.id === 'n1')?.isRead).toBe(true);
    expect(notifications.find((n) => n.id === 'n2')?.isRead).toBe(false);
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'id', 'n1');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
  });

  it('marking an already-read notification again is a safe no-op (idempotent)', async () => {
    useNotificationsFeedStore.setState({
      notifications: [{ id: 'n1', type: 'payment_received', title: 'Payment received', message: null, entityType: 'request', entityId: 'r1', isRead: true, createdAt: '2026-09-08T00:00:00.000Z' }],
      status: 'loaded',
      error: null,
    });
    const builder = makeUpdateBuilder({ error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useNotificationsFeedStore.getState().markAsRead('user-1', 'n1');

    expect(useNotificationsFeedStore.getState().notifications[0].isRead).toBe(true);
  });

  it('does not mutate local state when the server update fails', async () => {
    useNotificationsFeedStore.setState({
      notifications: [{ id: 'n1', type: 'payment_received', title: 'Payment received', message: null, entityType: 'request', entityId: 'r1', isRead: false, createdAt: '2026-09-08T00:00:00.000Z' }],
      status: 'loaded',
      error: null,
    });
    const builder = makeUpdateBuilder({ error: new Error('boom') });
    mockedSupabase.from.mockReturnValue(builder as never);

    await expect(useNotificationsFeedStore.getState().markAsRead('user-1', 'n1')).rejects.toThrow();
    expect(useNotificationsFeedStore.getState().notifications[0].isRead).toBe(false);
  });
});

describe('markAllAsRead', () => {
  it('marks every unread notification as read', async () => {
    useNotificationsFeedStore.setState({
      notifications: [
        { id: 'n1', type: 'payment_received', title: 'Payment received', message: null, entityType: 'request', entityId: 'r1', isRead: false, createdAt: '2026-09-08T00:00:00.000Z' },
        { id: 'n2', type: 'customer_added', title: 'Customer added', message: null, entityType: 'customer', entityId: 'c1', isRead: false, createdAt: '2026-09-08T00:00:00.000Z' },
        { id: 'n3', type: 'request_viewed', title: 'Request viewed', message: null, entityType: 'request', entityId: 'r2', isRead: true, createdAt: '2026-09-08T00:00:00.000Z' },
      ],
      status: 'loaded',
      error: null,
    });
    const builder = makeUpdateBuilder({ error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useNotificationsFeedStore.getState().markAllAsRead('user-1');

    expect(useNotificationsFeedStore.getState().notifications.every((n) => n.isRead)).toBe(true);
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'is_read', false);
  });
});

describe('reset', () => {
  it('clears notifications back to idle -- e.g. on sign-out / user switch', () => {
    useNotificationsFeedStore.setState({
      notifications: [{ id: 'n1', type: 'payment_received', title: 'Payment received', message: null, entityType: 'request', entityId: 'r1', isRead: false, createdAt: '2026-09-08T00:00:00.000Z' }],
      status: 'loaded',
      error: null,
    });
    useNotificationsFeedStore.getState().reset();
    expect(useNotificationsFeedStore.getState().notifications).toEqual([]);
    expect(useNotificationsFeedStore.getState().status).toBe('idle');
  });
});
