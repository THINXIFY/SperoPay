import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Template } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface TemplateState {
  templates: Template[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  addTemplate: (userId: string, input: Omit<Template, 'id'>) => Promise<Template>;
  updateTemplate: (userId: string, id: string, patch: Partial<Omit<Template, 'id'>>) => Promise<void>;
  deleteTemplate: (userId: string, id: string) => Promise<void>;
  reset: () => void;
}

function mapRow(row: {
  id: string;
  name: string;
  amount: string | number;
  description: string | null;
  expiry_option: Template['expiryOption'];
}): Template {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    description: row.description ?? undefined,
    expiryOption: row.expiry_option,
  };
}

export const useTemplateStore = create<TemplateState>()((set) => ({
  templates: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('payment_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ templates: (data ?? []).map(mapRow), status: 'loaded' });
    } catch (error) {
      set({ status: 'error', error: getDataErrorMessage(error, 'templates') });
    }
  },

  addTemplate: async (userId, input) => {
    const { data, error } = await supabase
      .from('payment_templates')
      .insert({
        user_id: userId,
        name: input.name,
        amount: input.amount,
        description: input.description ?? null,
        expiry_option: input.expiryOption,
      })
      .select('*')
      .single();
    if (error) {
      set({ error: getDataErrorMessage(error, 'templates', 'save') });
      throw error;
    }
    const template = mapRow(data);
    set((state) => ({ templates: [template, ...state.templates] }));
    return template;
  },

  updateTemplate: async (userId, id, patch) => {
    const dbPatch: Record<string, unknown> = {};
    if ('name' in patch) dbPatch.name = patch.name;
    if ('amount' in patch) dbPatch.amount = patch.amount;
    if ('description' in patch) dbPatch.description = patch.description ?? null;
    if ('expiryOption' in patch) dbPatch.expiry_option = patch.expiryOption;

    const { error } = await supabase.from('payment_templates').update(dbPatch).eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'templates', 'save') });
      throw error;
    }
    set((state) => ({ templates: state.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },

  deleteTemplate: async (userId, id) => {
    const { error } = await supabase.from('payment_templates').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'templates', 'save') });
      throw error;
    }
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
  },

  reset: () => set({ templates: [], status: 'idle', error: null }),
}));

registerResettable(() => useTemplateStore.getState().reset());
