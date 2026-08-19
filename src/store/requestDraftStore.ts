import { create } from 'zustand';
import type { ExpiryOption } from '../types';

interface RequestDraftState {
  amount: string;
  description: string;
  customerId: string | undefined;
  expiryOption: ExpiryOption;
  note: string;
  lastCreatedRequestId: string | null;
  setAmount: (amount: string) => void;
  setDescription: (description: string) => void;
  setCustomerId: (customerId: string | undefined) => void;
  setExpiryOption: (option: ExpiryOption) => void;
  setNote: (note: string) => void;
  setLastCreatedRequestId: (id: string | null) => void;
  prefillFrom: (values: { amount?: string; description?: string; customerId?: string; expiryOption?: ExpiryOption; note?: string }) => void;
  reset: () => void;
  startFresh: (defaultExpiryOption: ExpiryOption) => void;
}

const initialState = {
  amount: '0',
  description: '',
  customerId: undefined as string | undefined,
  expiryOption: '7d' as ExpiryOption,
  note: '',
  lastCreatedRequestId: null as string | null,
};

export const useRequestDraftStore = create<RequestDraftState>()((set) => ({
  ...initialState,
  setAmount: (amount) => set({ amount }),
  setDescription: (description) => set({ description }),
  setCustomerId: (customerId) => set({ customerId }),
  setExpiryOption: (expiryOption) => set({ expiryOption }),
  setNote: (note) => set({ note }),
  setLastCreatedRequestId: (lastCreatedRequestId) => set({ lastCreatedRequestId }),
  prefillFrom: (values) =>
    set((state) => ({
      ...initialState,
      ...values,
      amount: values.amount ?? initialState.amount,
      description: values.description ?? initialState.description,
      note: values.note ?? initialState.note,
    })),
  reset: () => set({ ...initialState }),
  startFresh: (defaultExpiryOption) => set({ ...initialState, expiryOption: defaultExpiryOption }),
}));
