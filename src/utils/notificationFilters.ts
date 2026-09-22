import type { AppNotification, AppNotificationType } from '../store/notificationsFeedStore';
import type { NotificationPreferences } from '../types/preferences';

export type NotificationFilter = 'all' | 'payments' | 'requests' | 'reminders' | 'recurring' | 'customers';

export const NOTIFICATION_FILTER_OPTIONS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All Activity' },
  { value: 'payments', label: 'Payments' },
  { value: 'requests', label: 'Requests' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'customers', label: 'Customers' },
];

const FILTER_TYPES: Record<Exclude<NotificationFilter, 'all'>, AppNotificationType[]> = {
  payments: ['payment_received', 'payment_partial'],
  requests: ['request_viewed', 'request_expired'],
  reminders: ['reminder_sent', 'reminder_failed'],
  recurring: ['recurring_generated'],
  customers: ['customer_added'],
};

export function filterNotifications(notifications: AppNotification[], filter: NotificationFilter): AppNotification[] {
  if (filter === 'all') return notifications;
  const types = FILTER_TYPES[filter];
  return notifications.filter((n) => types.includes(n.type));
}

// The reverse of FILTER_TYPES -- every AppNotificationType maps to exactly
// one category, built once at module load rather than re-derived per call.
const TYPE_TO_CATEGORY = Object.fromEntries(
  (Object.entries(FILTER_TYPES) as [Exclude<NotificationFilter, 'all'>, AppNotificationType[]][]).flatMap(([category, types]) =>
    types.map((type) => [type, category] as const)
  )
) as Record<AppNotificationType, Exclude<NotificationFilter, 'all'>>;

// Notification Preferences (Profile -> Notifications) controls what's
// VISIBLE, not what gets recorded -- a disabled category's underlying
// business events are still authoritatively logged server-side exactly as
// before (see notificationStore.ts's own comment); this only hides them
// from the feed, the unread count, and Home's Recent Activity preview.
export function filterNotificationsByPreferences(notifications: AppNotification[], preferences: NotificationPreferences): AppNotification[] {
  return notifications.filter((n) => preferences[TYPE_TO_CATEGORY[n.type]]);
}
