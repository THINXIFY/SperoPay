import { getNotificationPresentation, getNotificationNavigationTarget } from '../notificationPresentation';
import type { AppNotificationType } from '../../store/notificationsFeedStore';

const ALL_TYPES: AppNotificationType[] = [
  'payment_received',
  'payment_partial',
  'request_viewed',
  'request_expired',
  'reminder_sent',
  'reminder_failed',
  'recurring_generated',
  'customer_added',
];

describe('getNotificationPresentation', () => {
  it('returns a valid icon and tone for every notification type', () => {
    for (const type of ALL_TYPES) {
      const presentation = getNotificationPresentation(type);
      expect(presentation.icon).toEqual(expect.any(String));
      expect(['success', 'danger', 'warning', 'info', 'neutral']).toContain(presentation.tone);
    }
  });

  it('payment received is success-toned', () => {
    expect(getNotificationPresentation('payment_received').tone).toBe('success');
  });

  it('reminder failed is danger-toned (an attention state, not a silent neutral one)', () => {
    expect(getNotificationPresentation('reminder_failed').tone).toBe('danger');
  });

  it('recurring generated is neutral-toned', () => {
    expect(getNotificationPresentation('recurring_generated').tone).toBe('neutral');
  });
});

describe('getNotificationNavigationTarget', () => {
  it('routes a request-entity notification to Request Detail', () => {
    expect(getNotificationNavigationTarget({ entityType: 'request', entityId: 'r1' })).toBe('/(app)/requests/r1');
  });

  it('routes a customer-entity notification to Customer Detail', () => {
    expect(getNotificationNavigationTarget({ entityType: 'customer', entityId: 'c1' })).toBe('/(app)/customers/c1');
  });

  it('returns null (no dead navigation attempt) when entityId is missing', () => {
    expect(getNotificationNavigationTarget({ entityType: 'request', entityId: null })).toBeNull();
  });

  it('returns null for an unrecognized entity type', () => {
    expect(getNotificationNavigationTarget({ entityType: null, entityId: null })).toBeNull();
  });
});
