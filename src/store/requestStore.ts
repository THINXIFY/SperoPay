import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaymentRequest, Transaction } from '../types';
import { mockRequests } from '../data/requests';
import { buildPaymentRequest, type CreateRequestInput } from '../utils/buildPaymentRequest';
import {
  canBeginPaymentConfirmation,
  canCompletePayment,
  buildTransaction,
  DEMO_PAYMENT_FAILURE_RATE,
} from '../utils/paymentSimulation';
import { useRequestEventStore } from './requestEventStore';
import { useTransactionStore } from './transactionStore';

interface RequestState {
  requests: PaymentRequest[];
  isCreating: boolean;
  createRequest: (input: CreateRequestInput) => Promise<PaymentRequest>;
  getRequestById: (id: string) => PaymentRequest | undefined;
  cancelRequest: (id: string) => void;
  deleteRequest: (id: string) => void;
  beginPaymentConfirmation: (id: string) => boolean;
  completePayment: (id: string, options?: { forceFailure?: boolean }) => Transaction | null;
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
        const request = get().requests.find((r) => r.id === id);
        if (!request || request.status === 'paid' || request.status === 'expired' || request.status === 'cancelled') {
          return;
        }
        set((state) => ({
          requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)),
        }));
        useRequestEventStore.getState().addEvent(id, 'cancelled');
      },
      deleteRequest: (id) => {
        set((state) => ({ requests: state.requests.filter((r) => r.id !== id) }));
        useRequestEventStore.getState().removeEventsForRequest(id);
        useTransactionStore.getState().removeTransactionForRequest(id);
      },
      beginPaymentConfirmation: (id) => {
        const request = get().requests.find((r) => r.id === id);
        if (!canBeginPaymentConfirmation(request)) return false;
        set((state) => ({
          requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'confirming' } : r)),
        }));
        useRequestEventStore.getState().addEvent(id, 'payment_detected');
        return true;
      },
      completePayment: (id, options) => {
        const request = get().requests.find((r) => r.id === id);
        if (!canCompletePayment(request)) return null;

        const shouldFail = options?.forceFailure ?? Math.random() < DEMO_PAYMENT_FAILURE_RATE;
        if (shouldFail) {
          set((state) => ({
            requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'pending' } : r)),
          }));
          return null;
        }

        const transaction = useTransactionStore.getState().addTransaction(buildTransaction(request!));
        set((state) => ({
          requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'paid' } : r)),
        }));
        useRequestEventStore.getState().addEvent(id, 'payment_confirmed');
        return transaction;
      },
    }),
    { name: 'speropay/requests', storage: createJSONStorage(() => AsyncStorage) }
  )
);
