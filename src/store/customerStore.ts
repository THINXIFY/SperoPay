import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { createStaleGuard } from './staleGuard';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Customer } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

export interface AddCustomerInput {
  name: string;
  email: string;
  company?: string;
  notes?: string;
}

interface CustomerState {
  customers: Customer[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  addCustomer: (userId: string, input: AddCustomerInput) => Promise<Customer>;
  updateCustomer: (userId: string, id: string, patch: Partial<Omit<Customer, 'id'>>) => Promise<void>;
  getCustomerById: (id: string) => Customer | undefined;
  reset: () => void;
}

const AVATAR_COLORS: Customer['avatarColor'][] = ['mint', 'lavender', 'blue', 'red'];

const guard = createStaleGuard();

function mapRow(row: {
  id: string;
  name: string;
  email: string;
  avatar_color: Customer['avatarColor'];
  company: string | null;
  notes: string | null;
}): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarColor: row.avatar_color,
    company: row.company ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export const useCustomerStore = create<CustomerState>()((set, get) => ({
  customers: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    const token = guard.next();
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!guard.isCurrent(token)) return;
      set({ customers: (data ?? []).map(mapRow), status: 'loaded' });
    } catch (error) {
      if (!guard.isCurrent(token)) return;
      set({ status: 'error', error: getDataErrorMessage(error, 'customers') });
    }
  },

  addCustomer: async (userId, input) => {
    guard.next(); // invalidate any in-flight load — this optimistic write must survive it
    const avatarColor = AVATAR_COLORS[get().customers.length % AVATAR_COLORS.length];
    const { data, error } = await supabase
      .from('customers')
      .insert({
        user_id: userId,
        name: input.name,
        email: input.email,
        company: input.company ?? null,
        notes: input.notes ?? null,
        avatar_color: avatarColor,
      })
      .select('*')
      .single();
    if (error) {
      set({ error: getDataErrorMessage(error, 'customers', 'save') });
      throw error;
    }
    const customer = mapRow(data);
    set((state) => ({ customers: [customer, ...state.customers] }));
    return customer;
  },

  updateCustomer: async (userId, id, patch) => {
    guard.next();
    const dbPatch: Record<string, unknown> = {};
    if ('name' in patch) dbPatch.name = patch.name;
    if ('email' in patch) dbPatch.email = patch.email;
    if ('company' in patch) dbPatch.company = patch.company ?? null;
    if ('notes' in patch) dbPatch.notes = patch.notes ?? null;

    const { error } = await supabase.from('customers').update(dbPatch).eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'customers', 'save') });
      throw error;
    }
    set((state) => ({ customers: state.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  },

  getCustomerById: (id) => get().customers.find((c) => c.id === id),

  reset: () => {
    guard.next();
    set({ customers: [], status: 'idle', error: null });
  },
}));

registerResettable(() => useCustomerStore.getState().reset());
