import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { RequestEvent, RequestEventType } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface RequestEventState {
  events: RequestEvent[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  getEventsForRequest: (requestId: string) => RequestEvent[];
  addLocal: (event: RequestEvent) => void;
  reset: () => void;
}

function mapRow(row: { id: string; payment_request_id: string; event_type: RequestEventType; occurred_at: string }): RequestEvent {
  return { id: row.id, requestId: row.payment_request_id, type: row.event_type, occurredAt: row.occurred_at };
}

export const useRequestEventStore = create<RequestEventState>()((set, get) => ({
  events: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('request_events')
        .select('*')
        .eq('user_id', userId)
        .order('occurred_at', { ascending: true });
      if (error) throw error;
      set({ events: (data ?? []).map(mapRow), status: 'loaded' });
    } catch (error) {
      set({ status: 'error', error: getDataErrorMessage(error, 'requests') });
    }
  },

  getEventsForRequest: (requestId) =>
    get()
      .events.filter((e) => e.requestId === requestId)
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),

  // Events are written server-side only, inside the RPC functions
  // (create_payment_request etc.) — this just merges the resulting row into
  // the local cache after a successful RPC call, it never inserts directly.
  addLocal: (event) => set((state) => ({ events: [...state.events, event] })),

  reset: () => set({ events: [], status: 'idle', error: null }),
}));

registerResettable(() => useRequestEventStore.getState().reset());
