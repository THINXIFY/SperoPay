import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { createStaleGuard } from './staleGuard';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';

export type AppNotificationType =
  | 'payment_received'
  | 'payment_partial'
  | 'request_viewed'
  | 'request_expired'
  | 'reminder_sent'
  | 'reminder_failed'
  | 'recurring_generated'
  | 'customer_added';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string | null;
  entityType: 'request' | 'customer' | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface NotificationsFeedState {
  notifications: AppNotification[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  markAsRead: (userId: string, id: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  reset: () => void;
}

// Phase 6C: distinct from src/store/notificationStore.ts (the existing,
// unrelated PREFERENCES toggles -- see src/types/preferences.ts). This
// store holds the actual notification FEED rows from the new
// `notifications` table (migration 0018).
const guard = createStaleGuard();

// "Do not load thousands of activity records at once" -- a plain LIMIT is
// this app's existing level of pagination sophistication everywhere else
// (every other store loads its full, capped result set rather than a
// cursor-paginated one); 200 is comfortably more than a merchant would
// ever need to scroll through in this lightweight feed.
const LOAD_LIMIT = 200;

function mapRow(row: {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string | null;
  entity_type: 'request' | 'customer' | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export const useNotificationsFeedStore = create<NotificationsFeedState>()((set) => ({
  notifications: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    const token = guard.next();
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(LOAD_LIMIT);
      if (error) throw error;
      if (!guard.isCurrent(token)) return;
      set({ notifications: (data ?? []).map(mapRow), status: 'loaded' });
    } catch (error) {
      if (!guard.isCurrent(token)) return;
      set({ status: 'error', error: getDataErrorMessage(error, 'requests') });
    }
  },

  markAsRead: async (userId, id) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    }));
  },

  markAllAsRead: async (userId) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    if (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
    set((state) => ({
      notifications: state.notifications.map((n) => (n.isRead ? n : { ...n, isRead: true })),
    }));
  },

  reset: () => {
    guard.next();
    set({ notifications: [], status: 'idle', error: null });
  },
}));

registerResettable(() => useNotificationsFeedStore.getState().reset());
