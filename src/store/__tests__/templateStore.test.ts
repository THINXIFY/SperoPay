jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useTemplateStore } from '../templateStore';

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
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useTemplateStore.setState({ templates: [], status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads and maps rows', async () => {
    const builder = makeQueryBuilder({
      data: [{ id: 't1', name: 'Website', amount: '1000', description: null, expiry_option: '7d' }],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().loadForUser('user-1');

    expect(useTemplateStore.getState().templates).toEqual([
      { id: 't1', name: 'Website', amount: 1000, description: undefined, expiryOption: '7d' },
    ]);
  });
});

describe('addTemplate / updateTemplate / deleteTemplate', () => {
  it('addTemplate inserts scoped to user', async () => {
    const builder = makeQueryBuilder({
      data: { id: 't2', name: 'SEO', amount: '500', description: null, expiry_option: '7d' },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    const result = await useTemplateStore
      .getState()
      .addTemplate('user-1', { name: 'SEO', amount: 500, expiryOption: '7d' });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', name: 'SEO', amount: 500 }));
    expect(result.id).toBe('t2');
  });

  it('updateTemplate keeps the (userId, id, patch) call signature', async () => {
    useTemplateStore.setState({
      templates: [{ id: 't1', name: 'A', amount: 1, expiryOption: '7d' }],
      status: 'loaded',
      error: null,
    });
    const builder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().updateTemplate('user-1', 't1', { name: 'B' });

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'B' }));
    expect(useTemplateStore.getState().templates[0].name).toBe('B');
  });

  it('deleteTemplate removes locally after a successful delete', async () => {
    useTemplateStore.setState({
      templates: [{ id: 't1', name: 'A', amount: 1, expiryOption: '7d' }],
      status: 'loaded',
      error: null,
    });
    const builder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTemplateStore.getState().deleteTemplate('user-1', 't1');

    expect(useTemplateStore.getState().templates).toEqual([]);
  });
});
