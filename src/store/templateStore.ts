import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { createStaleGuard } from './staleGuard';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import { DEFAULT_ASSET, type AssetSymbol } from '../config/assets';
import type { ExpiryOption, ReminderPreset, ReminderRule, Template } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

// What a create/edit form actually supplies -- deliberately narrower than
// Template itself, which also carries server-managed fields (currency,
// isFavorite, isArchived, usageCount, lastUsedAt) that a form never sets
// directly (favoriting/archiving/usage-tracking each have their own
// dedicated actions below).
export interface TemplateInput {
  name: string;
  amount?: number;
  // Defaults to DEFAULT_ASSET (USDC) when omitted, matching every
  // pre-Phase-7 caller and the payment_templates.currency column's own
  // default.
  currency?: AssetSymbol;
  description?: string;
  expiryOption: ExpiryOption;
  customerId?: string;
  remindersEnabled: boolean;
  reminderPreset: ReminderPreset;
  reminderCustomRules?: ReminderRule[];
}

interface TemplateState {
  templates: Template[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  addTemplate: (userId: string, input: TemplateInput) => Promise<Template>;
  updateTemplate: (userId: string, id: string, patch: Partial<TemplateInput>) => Promise<void>;
  deleteTemplate: (userId: string, id: string) => Promise<void>;
  duplicateTemplate: (userId: string, id: string) => Promise<Template>;
  toggleFavorite: (userId: string, id: string) => Promise<void>;
  setArchived: (userId: string, id: string, archived: boolean) => Promise<void>;
  recordUsage: (userId: string, id: string) => Promise<void>;
  reset: () => void;
}

const guard = createStaleGuard();

function mapRow(row: {
  id: string;
  name: string;
  amount: string | number | null;
  currency: string;
  description: string | null;
  expiry_option: Template['expiryOption'];
  customer_id: string | null;
  reminders_enabled: boolean;
  reminder_preset: ReminderPreset;
  reminder_custom_rules: ReminderRule[] | null;
  is_favorite: boolean;
  is_archived: boolean;
  usage_count: number;
  last_used_at: string | null;
}): Template {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount === null ? undefined : Number(row.amount),
    currency: (row.currency as Template['currency']) ?? DEFAULT_ASSET,
    description: row.description ?? undefined,
    expiryOption: row.expiry_option,
    customerId: row.customer_id ?? undefined,
    remindersEnabled: row.reminders_enabled,
    reminderPreset: row.reminder_preset,
    reminderCustomRules: row.reminder_custom_rules ?? undefined,
    isFavorite: row.is_favorite,
    isArchived: row.is_archived,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at ?? undefined,
  };
}

function toDbPatch(input: Partial<TemplateInput>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if ('name' in input) patch.name = input.name;
  if ('amount' in input) patch.amount = input.amount ?? null;
  if ('currency' in input) patch.currency = input.currency ?? DEFAULT_ASSET;
  if ('description' in input) patch.description = input.description ?? null;
  if ('expiryOption' in input) patch.expiry_option = input.expiryOption;
  if ('customerId' in input) patch.customer_id = input.customerId ?? null;
  if ('remindersEnabled' in input) patch.reminders_enabled = input.remindersEnabled;
  if ('reminderPreset' in input) patch.reminder_preset = input.reminderPreset;
  if ('reminderCustomRules' in input) patch.reminder_custom_rules = input.reminderCustomRules ?? null;
  return patch;
}

export const useTemplateStore = create<TemplateState>()((set, get) => ({
  templates: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    const token = guard.next();
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('payment_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!guard.isCurrent(token)) return;
      set({ templates: (data ?? []).map(mapRow), status: 'loaded' });
    } catch (error) {
      if (!guard.isCurrent(token)) return;
      set({ status: 'error', error: getDataErrorMessage(error, 'templates') });
    }
  },

  addTemplate: async (userId, input) => {
    guard.next();
    const { data, error } = await supabase
      .from('payment_templates')
      .insert({
        user_id: userId,
        name: input.name,
        amount: input.amount ?? null,
        currency: input.currency ?? DEFAULT_ASSET,
        description: input.description ?? null,
        expiry_option: input.expiryOption,
        customer_id: input.customerId ?? null,
        reminders_enabled: input.remindersEnabled,
        reminder_preset: input.reminderPreset,
        reminder_custom_rules: input.reminderCustomRules ?? null,
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
    guard.next();
    const dbPatch = toDbPatch(patch);

    const { error } = await supabase.from('payment_templates').update(dbPatch).eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'templates', 'save') });
      throw error;
    }
    set((state) => ({ templates: state.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },

  deleteTemplate: async (userId, id) => {
    guard.next();
    const { error } = await supabase.from('payment_templates').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'templates', 'save') });
      throw error;
    }
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
  },

  // A copy the user can then edit -- deliberately starts fresh (not a
  // favorite, zero uses, never used) rather than inheriting the source
  // template's own history, since it's a genuinely new template from here.
  duplicateTemplate: async (userId, id) => {
    const source = get().templates.find((t) => t.id === id);
    if (!source) throw new Error('Template not found');
    return get().addTemplate(userId, {
      name: `${source.name} (Copy)`,
      amount: source.amount,
      currency: source.currency,
      description: source.description,
      expiryOption: source.expiryOption,
      customerId: source.customerId,
      remindersEnabled: source.remindersEnabled,
      reminderPreset: source.reminderPreset,
      reminderCustomRules: source.reminderCustomRules,
    });
  },

  toggleFavorite: async (userId, id) => {
    guard.next();
    const current = get().templates.find((t) => t.id === id);
    if (!current) return;
    const nextFavorite = !current.isFavorite;
    // Optimistic -- favoriting is low-stakes and should feel instant; rolled
    // back below if the write actually fails.
    set((state) => ({
      templates: state.templates.map((t) => (t.id === id ? { ...t, isFavorite: nextFavorite } : t)),
    }));
    const { error } = await supabase
      .from('payment_templates')
      .update({ is_favorite: nextFavorite })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) {
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? { ...t, isFavorite: !nextFavorite } : t)),
      }));
      set({ error: getDataErrorMessage(error, 'templates', 'save') });
      throw error;
    }
  },

  setArchived: async (userId, id, archived) => {
    guard.next();
    const { error } = await supabase
      .from('payment_templates')
      .update({ is_archived: archived })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'templates', 'save') });
      throw error;
    }
    set((state) => ({ templates: state.templates.map((t) => (t.id === id ? { ...t, isArchived: archived } : t)) }));
  },

  // Called after a payment request is actually created from a template
  // (never on a bare "Use Template" tap, which only prefills a draft) --
  // see app/request/details.tsx. Deliberately never throws: a failed usage-
  // count bump must not affect the request that was just successfully
  // created around it, and the caller doesn't await it for that reason.
  recordUsage: async (userId, id) => {
    guard.next();
    const current = get().templates.find((t) => t.id === id);
    if (!current) return;
    const nowIso = new Date().toISOString();
    const nextCount = current.usageCount + 1;
    const { error } = await supabase
      .from('payment_templates')
      .update({ usage_count: nextCount, last_used_at: nowIso })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return;
    set((state) => ({
      templates: state.templates.map((t) => (t.id === id ? { ...t, usageCount: nextCount, lastUsedAt: nowIso } : t)),
    }));
  },

  reset: () => {
    guard.next();
    set({ templates: [], status: 'idle', error: null });
  },
}));

registerResettable(() => useTemplateStore.getState().reset());
