import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaymentRequest } from '../types';
import { mockRequests } from '../data/requests';
import { buildPaymentRequest, type CreateRequestInput } from '../utils/buildPaymentRequest';
import { useRequestEventStore } from './requestEventStore';

interface RequestState {
  requests: PaymentRequest[];
  isCreating: boolean;
  createRequest: (input: CreateRequestInput) => Promise<PaymentRequest>;
  getRequestById: (id: string) => PaymentRequest | undefined;
  cancelRequest: (id: string) => void;
  deleteRequest: (id: string) => void;
}

function mockDelay(ms = 1400) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useRequestStore = create<RequestState>()(
  persist(
    (set, get) => ({
      requests: mockRequests,
      isCreating: false,
      createRequest: async (input) => {
        set({ isCreating: true });
        await mockDelay();
        const request = buildPaymentRequest(input);
        set((state) => ({ requests: [request, ...state.requests], isCreating: false }));
        useRequestEventStore.getState().addEvent(request.id, 'created');
        return request;
      },
      getRequestById: (id) => get().requests.find((r) => r.id === id),
      cancelRequest: (id) => {
        set((state) => ({
          requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)),
        }));
        useRequestEventStore.getState().addEvent(id, 'cancelled');
      },
      deleteRequest: (id) => set((state) => ({ requests: state.requests.filter((r) => r.id !== id) })),
    }),
    { name: 'speropay/requests', storage: createJSONStorage(() => AsyncStorage) }
  )
);
