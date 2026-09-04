import { create } from 'zustand';
import type { ExpiryOption } from '../types';
import { registerResettable } from './dataLifecycle';

interface RequestDraftState {
  amount: string;
  description: string;
  customerId: string | undefined;
  expiryOption: ExpiryOption;
  note: string;
  lastCreatedRequestId: string | null;
  // Set only by prefillFrom when a draft originates from "Use Template" --
  // lets a successful Create Request record a usage count against the
  // right template (see app/request/details.tsx) without templates and
  // requests needing to know about each other beyond this one field.
  sourceTemplateId: string | undefined;
  setAmount: (amount: string) => void;
  setDescription: (description: string) => void;
  setCustomerId: (customerId: string | undefined) => void;
  setExpiryOption: (option: ExpiryOption) => void;
  setNote: (note: string) => void;
  setLastCreatedRequestId: (id: string | null) => void;
  prefillFrom: (values: {
    amount?: string;
    description?: string;
    customerId?: string;
    expiryOption?: ExpiryOption;
    note?: string;
    sourceTemplateId?: string;
  }) => void;
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
  sourceTemplateId: undefined as string | undefined,
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
      expiryOption: values.expiryOption ?? initialState.expiryOption,
    })),
  reset: () => set({ ...initialState }),
  startFresh: (defaultExpiryOption) => set({ ...initialState, expiryOption: defaultExpiryOption }),
}));

// This store is in-memory only (no network load, no persistence) so it needs
// no stale-guard token — but without this registration a draft started by
// User A (e.g. a customerId picked mid-flow) could still be sitting in
// memory if User B signs in without ever hitting one of the screens that
// already call reset()/startFresh()/prefillFrom() themselves.
registerResettable(() => useRequestDraftStore.getState().reset());
