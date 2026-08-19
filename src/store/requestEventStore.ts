import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RequestEvent, RequestEventType } from '../types';
import { mockRequestEvents } from '../data/requestEvents';
import { generateId } from '../utils/ids';

interface RequestEventState {
  events: RequestEvent[];
  addEvent: (requestId: string, type: RequestEventType) => RequestEvent;
  getEventsForRequest: (requestId: string) => RequestEvent[];
}

export const useRequestEventStore = create<RequestEventState>()(
  persist(
    (set, get) => ({
      events: mockRequestEvents,
      addEvent: (requestId, type) => {
        const event: RequestEvent = {
          id: generateId(),
          requestId,
          type,
          occurredAt: new Date().toISOString(),
        };
        set((state) => ({ events: [...state.events, event] }));
        return event;
      },
      getEventsForRequest: (requestId) =>
        get()
          .events.filter((e) => e.requestId === requestId)
          .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),
    }),
    { name: 'speropay/requestEvents', storage: createJSONStorage(() => AsyncStorage) }
  )
);
