import type { Ionicons } from '@expo/vector-icons';
import type { AppNotification, AppNotificationType } from '../store/notificationsFeedStore';

// Same 5-tone vocabulary activityPresentation.ts already established for
// Request Detail's Timeline -- reused verbatim rather than inventing a
// second tone enum for what is, visually, the exact same concept (spec:
// "restrained semantic styling").
export type NotificationTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export interface NotificationPresentation {
  icon: keyof typeof Ionicons.glyphMap;
  tone: NotificationTone;
}

// Purely icon/tone -- title/message are already authored server-side at
// insert time (migration 0018) and stored on the row itself, unlike
// activityPresentation.ts's describeActivityEvent (which derives copy
// entirely client-side from a bare event_type). Keeping icon/tone as the
// only client-side derivation here means the stored copy is always what's
// shown, with no risk of the client's derivation drifting from what the
// server actually recorded.
const PRESENTATION: Record<AppNotificationType, NotificationPresentation> = {
  payment_received: { icon: 'checkmark-circle', tone: 'success' },
  payment_partial: { icon: 'checkmark-circle-outline', tone: 'success' },
  request_viewed: { icon: 'eye-outline', tone: 'info' },
  request_expired: { icon: 'time-outline', tone: 'warning' },
  reminder_sent: { icon: 'notifications-outline', tone: 'neutral' },
  reminder_failed: { icon: 'warning-outline', tone: 'danger' },
  recurring_generated: { icon: 'repeat-outline', tone: 'neutral' },
  customer_added: { icon: 'person-add-outline', tone: 'neutral' },
};

export function getNotificationPresentation(type: AppNotificationType): NotificationPresentation {
  return PRESENTATION[type];
}

// Maps a tone to the specific ThemeColors key that renders it -- returned
// as a key (not a resolved color) since this is a plain util with no
// access to useTheme(); every call site does colors[toneColorKey(...)].
// Shared by both the Notifications screen and Home's Recent Activity
// preview so the two can never render the same notification in two
// different colors.
const TONE_COLOR_KEY: Record<NotificationTone, 'success' | 'error' | 'pending' | 'softBlueText' | 'textSecondary'> = {
  success: 'success',
  danger: 'error',
  warning: 'pending',
  info: 'softBlueText',
  neutral: 'textSecondary',
};

export function notificationToneColorKey(tone: NotificationTone): 'success' | 'error' | 'pending' | 'softBlueText' | 'textSecondary' {
  return TONE_COLOR_KEY[tone];
}

// Every request-entity notification routes to Request Detail -- it already
// surfaces "View Receipt" once a request is paid, so "Payment received ->
// Request Detail / Receipt" (spec) is satisfied by one consistent
// destination rather than type-specific routing that would need its own
// fallback for e.g. a receipt that isn't available yet.
export function getNotificationNavigationTarget(notification: Pick<AppNotification, 'entityType' | 'entityId'>): string | null {
  if (!notification.entityId) return null;
  if (notification.entityType === 'request') return `/(app)/requests/${notification.entityId}`;
  if (notification.entityType === 'customer') return `/(app)/customers/${notification.entityId}`;
  return null;
}
