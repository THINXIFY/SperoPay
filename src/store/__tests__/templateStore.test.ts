jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useTemplateStore } from '../templateStore';
import type { Template } from '../../types';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.insert = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.delete = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  // Makes the builder itself awaitable at any point in the chain (e.g. a
  // plain `.update(...).eq('id', x).eq('user_id', y)` with no further
  // .single()/.maybeSingle()) -- matching the real Supabase
  // PostgrestFilterBuilder, which is chainable AND awaitable
  // simultaneously. Without this, `await` mid-chain resolves to the
  // builder object itself rather than {data, error}.
  (builder as unknown as { then: typeof Promise.prototype.then }).then = (onFulfilled) =>
    Promise.resolve(result).then(onFulfilled as never);
  return builder;
}

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 't1',
    name: 'A',
    amount: 1,
    currency: 'USDC',
    expiryOption: '7d',
    remindersEnabled: true,
    reminderPreset: 'standard',
    isFavorite: false,
    isArchived: false,
    usageCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useTemplateStore.setState({ templates: [], status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads and maps rows, including the new management columns', async () => {
    const builder = makeQueryBuilder({
      data: [
        {
          id: 't1',
          name: 'Website',
          amount: '1000',
          currency: 'USDC',
          description: null,
          expiry_option: '7d',
          customer_id: 'cust-1',
          reminders_enabled: false,
          reminder_preset: 'standard',
          reminder_custom_rules: null,
          is_favorite: true,
          is_archived: false,
          usage_count: 3,
          last_used_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().loadForUser('user-1');

    expect(useTemplateStore.getState().templates).toEqual([
      {
        id: 't1',
        name: 'Website',
        amount: 1000,
        currency: 'USDC',
        description: undefined,
        expiryOption: '7d',
        customerId: 'cust-1',
        remindersEnabled: false,
        reminderPreset: 'standard',
        reminderCustomRules: undefined,
        isFavorite: true,
        isArchived: false,
        usageCount: 3,
        lastUsedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('maps a null amount to undefined (a flexible-amount template)', async () => {
    const builder = makeQueryBuilder({
      data: [
        {
          id: 't1',
          name: 'Flexible',
          amount: null,
          currency: 'USDC',
          description: null,
          expiry_option: 'never',
          customer_id: null,
          reminders_enabled: true,
          reminder_preset: 'standard',
          reminder_custom_rules: null,
          is_favorite: false,
          is_archived: false,
          usage_count: 0,
          last_used_at: null,
        },
      ],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().loadForUser('user-1');

    expect(useTemplateStore.getState().templates[0].amount).toBeUndefined();
  });
});

describe('addTemplate / updateTemplate / deleteTemplate', () => {
  it('addTemplate inserts scoped to user, including the new fields', async () => {
    const builder = makeQueryBuilder({
      data: {
        id: 't2',
        name: 'SEO',
        amount: '500',
        currency: 'USDC',
        description: null,
        expiry_option: '7d',
        customer_id: 'cust-2',
        reminders_enabled: true,
        is_favorite: false,
        is_archived: false,
        usage_count: 0,
        last_used_at: null,
      },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    const result = await useTemplateStore
      .getState()
      .addTemplate('user-1', {
        name: 'SEO',
        amount: 500,
        expiryOption: '7d',
        customerId: 'cust-2',
        remindersEnabled: true,
        reminderPreset: 'standard',
      });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', name: 'SEO', amount: 500, customer_id: 'cust-2', reminders_enabled: true })
    );
    expect(result.id).toBe('t2');
  });

  // Phase 7: a template created with an explicit EURC currency must write
  // EURC, not silently default to USDC.
  it('addTemplate writes the given EURC currency, not the USDC default', async () => {
    const builder = makeQueryBuilder({
      data: {
        id: 't-eurc',
        name: 'Retainer',
        amount: '1000',
        currency: 'EURC',
        description: null,
        expiry_option: '7d',
        customer_id: null,
        reminders_enabled: true,
        is_favorite: false,
        is_archived: false,
        usage_count: 0,
        last_used_at: null,
      },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    const result = await useTemplateStore
      .getState()
      .addTemplate('user-1', { name: 'Retainer', amount: 1000, currency: 'EURC', expiryOption: '7d', remindersEnabled: true, reminderPreset: 'standard' });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ currency: 'EURC' }));
    expect(result.currency).toBe('EURC');
  });

  it('addTemplate defaults to USDC when no currency is given', async () => {
    const builder = makeQueryBuilder({
      data: { id: 't-default', name: 'X', amount: '1', currency: 'USDC', description: null, expiry_option: '7d', customer_id: null, reminders_enabled: true, is_favorite: false, is_archived: false, usage_count: 0, last_used_at: null },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().addTemplate('user-1', { name: 'X', expiryOption: '7d', remindersEnabled: true, reminderPreset: 'standard' });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USDC' }));
  });

  it('addTemplate writes a null amount for a flexible-amount template', async () => {
    const builder = makeQueryBuilder({
      data: {
        id: 't3',
        name: 'Flexible',
        amount: null,
        currency: 'USDC',
        description: null,
        expiry_option: '7d',
        customer_id: null,
        reminders_enabled: true,
        is_favorite: false,
        is_archived: false,
        usage_count: 0,
        last_used_at: null,
      },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore
      .getState()
      .addTemplate('user-1', { name: 'Flexible', expiryOption: '7d', remindersEnabled: true, reminderPreset: 'standard' });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ amount: null }));
  });

  it('updateTemplate keeps the (userId, id, patch) call signature', async () => {
    useTemplateStore.setState({ templates: [makeTemplate()], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().updateTemplate('user-1', 't1', { name: 'B' });

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'B' }));
    expect(useTemplateStore.getState().templates[0].name).toBe('B');
  });

  it('deleteTemplate removes locally after a successful delete', async () => {
    useTemplateStore.setState({ templates: [makeTemplate()], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().deleteTemplate('user-1', 't1');

    expect(useTemplateStore.getState().templates).toEqual([]);
  });
});

describe('duplicateTemplate', () => {
  it('inserts a copy with "(Copy)" appended, starting fresh (not a favorite, zero uses)', async () => {
    useTemplateStore.setState({
      templates: [
        makeTemplate({
          id: 't1',
          name: 'Website Design',
          isFavorite: true,
          usageCount: 12,
          lastUsedAt: '2026-01-01T00:00:00.000Z',
        }),
      ],
      status: 'loaded',
      error: null,
    });
    const builder = makeQueryBuilder({
      data: {
        id: 't-copy',
        name: 'Website Design (Copy)',
        amount: '1',
        currency: 'USDC',
        description: null,
        expiry_option: '7d',
        customer_id: null,
        reminders_enabled: true,
        is_favorite: false,
        is_archived: false,
        usage_count: 0,
        last_used_at: null,
      },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    const copy = await useTemplateStore.getState().duplicateTemplate('user-1', 't1');

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Website Design (Copy)' }));
    expect(copy.isFavorite).toBe(false);
    expect(copy.usageCount).toBe(0);
  });

  it('rejects when the source template is not found', async () => {
    await expect(useTemplateStore.getState().duplicateTemplate('user-1', 'missing')).rejects.toThrow();
  });

  // Phase 7: duplicating a EURC template must preserve EURC, not reset to
  // the USDC default (same "preserve the original currency" rule as
  // creating a request from a template).
  it('preserves the source template\'s EURC currency on the copy', async () => {
    useTemplateStore.setState({
      templates: [makeTemplate({ id: 't1', name: 'Monthly Retainer', currency: 'EURC' })],
      status: 'loaded',
      error: null,
    });
    const builder = makeQueryBuilder({
      data: { id: 't-copy', name: 'Monthly Retainer (Copy)', amount: '1', currency: 'EURC', description: null, expiry_option: '7d', customer_id: null, reminders_enabled: true, is_favorite: false, is_archived: false, usage_count: 0, last_used_at: null },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().duplicateTemplate('user-1', 't1');

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ currency: 'EURC' }));
  });
});

describe('toggleFavorite', () => {
  it('optimistically flips the flag and persists it', async () => {
    useTemplateStore.setState({ templates: [makeTemplate({ isFavorite: false })], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().toggleFavorite('user-1', 't1');

    expect(builder.update).toHaveBeenCalledWith({ is_favorite: true });
    expect(useTemplateStore.getState().templates[0].isFavorite).toBe(true);
  });

  it('rolls back the optimistic flip if the write fails', async () => {
    useTemplateStore.setState({ templates: [makeTemplate({ isFavorite: false })], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: null, error: new Error('network request failed') });
    mockedSupabase.from.mockReturnValue(builder as never);

    await expect(useTemplateStore.getState().toggleFavorite('user-1', 't1')).rejects.toThrow();

    expect(useTemplateStore.getState().templates[0].isFavorite).toBe(false);
  });
});

describe('setArchived', () => {
  it('archives a template', async () => {
    useTemplateStore.setState({ templates: [makeTemplate({ isArchived: false })], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().setArchived('user-1', 't1', true);

    expect(builder.update).toHaveBeenCalledWith({ is_archived: true });
    expect(useTemplateStore.getState().templates[0].isArchived).toBe(true);
  });

  it('restores an archived template', async () => {
    useTemplateStore.setState({ templates: [makeTemplate({ isArchived: true })], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().setArchived('user-1', 't1', false);

    expect(useTemplateStore.getState().templates[0].isArchived).toBe(false);
  });
});

describe('recordUsage', () => {
  it('increments usage_count and sets last_used_at', async () => {
    useTemplateStore.setState({ templates: [makeTemplate({ usageCount: 2 })], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().recordUsage('user-1', 't1');

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ usage_count: 3 }));
    expect(useTemplateStore.getState().templates[0].usageCount).toBe(3);
    expect(useTemplateStore.getState().templates[0].lastUsedAt).toBeDefined();
  });

  it('never throws -- a failed usage bump must not affect the request that was just created', async () => {
    useTemplateStore.setState({ templates: [makeTemplate({ usageCount: 2 })], status: 'loaded', error: null });
    const builder = makeQueryBuilder({ data: null, error: new Error('network request failed') });
    mockedSupabase.from.mockReturnValue(builder as never);

    await expect(useTemplateStore.getState().recordUsage('user-1', 't1')).resolves.toBeUndefined();
    // The local count must not have been bumped either, since the write failed.
    expect(useTemplateStore.getState().templates[0].usageCount).toBe(2);
  });

  it('is a no-op when the template is not found locally', async () => {
    await expect(useTemplateStore.getState().recordUsage('user-1', 'missing')).resolves.toBeUndefined();
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });
});
