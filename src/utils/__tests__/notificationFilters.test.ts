import { filterNotifications, filterNotificationsByPreferences, NOTIFICATION_FILTER_OPTIONS } from '../notificationFilters';
import type { AppNotification } from '../../store/notificationsFeedStore';
import type { NotificationPreferences } from '../../types/preferences';

function make(type: AppNotification['type'], id: string): AppNotification {
  return { id, type, title: type, message: null, entityType: 'request', entityId: 'r1', isRead: false, createdAt: '2026-09-08T00:00:00.000Z' };
}

const ALL: AppNotification[] = [
  make('payment_received', 'a'),
  make('payment_partial', 'b'),
  make('request_viewed', 'c'),
  make('request_expired', 'd'),
  make('reminder_sent', 'e'),
  make('reminder_failed', 'f'),
  make('recurring_generated', 'g'),
  make('customer_added', 'h'),
];

describe('NOTIFICATION_FILTER_OPTIONS', () => {
  it('lists all six options in spec order', () => {
    expect(NOTIFICATION_FILTER_OPTIONS.map((o) => o.value)).toEqual(['all', 'payments', 'requests', 'reminders', 'recurring', 'customers']);
  });
});

describe('filterNotifications', () => {
  it('"all" returns every notification unchanged', () => {
    expect(filterNotifications(ALL, 'all')).toHaveLength(8);
  });

  it('"payments" includes payment_received and payment_partial only', () => {
    expect(filterNotifications(ALL, 'payments').map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('"requests" includes request_viewed and request_expired only', () => {
    expect(filterNotifications(ALL, 'requests').map((n) => n.id).sort()).toEqual(['c', 'd']);
  });

  it('"reminders" includes reminder_sent and reminder_failed only', () => {
    expect(filterNotifications(ALL, 'reminders').map((n) => n.id).sort()).toEqual(['e', 'f']);
  });

  it('"recurring" includes recurring_generated only', () => {
    expect(filterNotifications(ALL, 'recurring').map((n) => n.id)).toEqual(['g']);
  });

  it('"customers" includes customer_added only', () => {
    expect(filterNotifications(ALL, 'customers').map((n) => n.id)).toEqual(['h']);
  });

  it('returns an empty array when nothing matches the filter', () => {
    expect(filterNotifications([make('payment_received', 'a')], 'customers')).toEqual([]);
  });
});

const ALL_ENABLED: NotificationPreferences = { payments: true, requests: true, reminders: true, recurring: true, customers: true };

describe('filterNotificationsByPreferences', () => {
  it('returns everything when every category is enabled', () => {
    expect(filterNotificationsByPreferences(ALL, ALL_ENABLED)).toHaveLength(8);
  });

  it('hides an entire category when its preference is disabled', () => {
    const visible = filterNotificationsByPreferences(ALL, { ...ALL_ENABLED, payments: false });
    expect(visible.some((n) => n.type === 'payment_received' || n.type === 'payment_partial')).toBe(false);
    expect(visible).toHaveLength(6);
  });

  it('hides customer_added specifically when customers is disabled, leaving everything else', () => {
    const visible = filterNotificationsByPreferences(ALL, { ...ALL_ENABLED, customers: false });
    expect(visible.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('returns an empty array when every category is disabled', () => {
    const visible = filterNotificationsByPreferences(ALL, {
      payments: false,
      requests: false,
      reminders: false,
      recurring: false,
      customers: false,
    });
    expect(visible).toEqual([]);
  });
});
