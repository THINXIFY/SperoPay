import { create } from 'zustand';
import type { ExpiryOption, ReminderPreset, ReminderRule, DepositType } from '../types';
import { registerResettable } from './dataLifecycle';
import { DEFAULT_ASSET, type AssetSymbol } from '../config/assets';

interface RequestDraftState {
  amount: string;
  currency: AssetSymbol;
  description: string;
  customerId: string | undefined;
  expiryOption: ExpiryOption;
  note: string;
  // ISO string, or undefined if the merchant hasn't set one -- required for
  // reminders to be schedulable (see request/details.tsx's reminders
  // section and reminderStore.saveSchedule).
  dueAt: string | undefined;
  remindersEnabled: boolean;
  reminderPreset: ReminderPreset;
  reminderCustomRules: ReminderRule[] | undefined;
  allowPartialPayments: boolean;
  depositType: DepositType | undefined;
  depositValue: number | undefined;
  lastCreatedRequestId: string | null;
  // Set only by prefillFrom when a draft originates from "Use Template" --
  // lets a successful Create Request record a usage count against the
  // right template (see app/request/details.tsx) without templates and
  // requests needing to know about each other beyond this one field.
  sourceTemplateId: string | undefined;
  setAmount: (amount: string) => void;
  setCurrency: (currency: AssetSymbol) => void;
  setDescription: (description: string) => void;
  setCustomerId: (customerId: string | undefined) => void;
  setExpiryOption: (option: ExpiryOption) => void;
  setNote: (note: string) => void;
  setDueAt: (dueAt: string | undefined) => void;
  setRemindersEnabled: (enabled: boolean) => void;
  setReminderPreset: (preset: ReminderPreset) => void;
  setReminderCustomRules: (rules: ReminderRule[] | undefined) => void;
  setAllowPartialPayments: (allow: boolean) => void;
  setDepositType: (type: DepositType | undefined) => void;
  setDepositValue: (value: number | undefined) => void;
  setLastCreatedRequestId: (id: string | null) => void;
  prefillFrom: (values: {
    amount?: string;
    currency?: AssetSymbol;
    description?: string;
    customerId?: string;
    expiryOption?: ExpiryOption;
    note?: string;
    sourceTemplateId?: string;
    remindersEnabled?: boolean;
    reminderPreset?: ReminderPreset;
    reminderCustomRules?: ReminderRule[];
    allowPartialPayments?: boolean;
    depositType?: DepositType;
    depositValue?: number;
  }) => void;
  reset: () => void;
  startFresh: (defaultExpiryOption: ExpiryOption, defaultCurrency?: AssetSymbol) => void;
}

const initialState = {
  amount: '0',
  currency: DEFAULT_ASSET,
  description: '',
  customerId: undefined as string | undefined,
  expiryOption: '7d' as ExpiryOption,
  note: '',
  dueAt: undefined as string | undefined,
  remindersEnabled: false,
  reminderPreset: 'standard' as ReminderPreset,
  reminderCustomRules: undefined as ReminderRule[] | undefined,
  allowPartialPayments: false,
  depositType: undefined as DepositType | undefined,
  depositValue: undefined as number | undefined,
  lastCreatedRequestId: null as string | null,
  sourceTemplateId: undefined as string | undefined,
};

export const useRequestDraftStore = create<RequestDraftState>()((set) => ({
  ...initialState,
  setAmount: (amount) => set({ amount }),
  setCurrency: (currency) => set({ currency }),
  setDescription: (description) => set({ description }),
  setCustomerId: (customerId) => set({ customerId }),
  setExpiryOption: (expiryOption) => set({ expiryOption }),
  setNote: (note) => set({ note }),
  setDueAt: (dueAt) => set({ dueAt }),
  setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
  setReminderPreset: (reminderPreset) => set({ reminderPreset }),
  setReminderCustomRules: (reminderCustomRules) => set({ reminderCustomRules }),
  setAllowPartialPayments: (allowPartialPayments) => set({ allowPartialPayments }),
  setDepositType: (depositType) => set({ depositType }),
  setDepositValue: (depositValue) => set({ depositValue }),
  setLastCreatedRequestId: (lastCreatedRequestId) => set({ lastCreatedRequestId }),
  prefillFrom: (values) =>
    set((state) => ({
      ...initialState,
      ...values,
      amount: values.amount ?? initialState.amount,
      currency: values.currency ?? initialState.currency,
      description: values.description ?? initialState.description,
      note: values.note ?? initialState.note,
      expiryOption: values.expiryOption ?? initialState.expiryOption,
      remindersEnabled: values.remindersEnabled ?? initialState.remindersEnabled,
      reminderPreset: values.reminderPreset ?? initialState.reminderPreset,
      allowPartialPayments: values.allowPartialPayments ?? initialState.allowPartialPayments,
    })),
  reset: () => set({ ...initialState }),
  startFresh: (defaultExpiryOption, defaultCurrency) =>
    set({ ...initialState, expiryOption: defaultExpiryOption, currency: defaultCurrency ?? initialState.currency }),
}));

// This store is in-memory only (no network load, no persistence) so it needs
// no stale-guard token — but without this registration a draft started by
// User A (e.g. a customerId picked mid-flow) could still be sitting in
// memory if User B signs in without ever hitting one of the screens that
// already call reset()/startFresh()/prefillFrom() themselves.
registerResettable(() => useRequestDraftStore.getState().reset());
