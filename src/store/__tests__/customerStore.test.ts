jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useCustomerStore } from '../customerStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.insert = jest.fn(chain);
  builder.update = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useCustomerStore.setState({ customers: [], status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads and maps rows to the Customer shape', async () => {
    const builder = makeQueryBuilder({
      data: [{ id: 'c1', name: 'Jane', email: 'jane@x.com', avatar_color: 'blue', company: null, notes: null }],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useCustomerStore.getState().loadForUser('user-1');

    expect(useCustomerStore.getState().customers).toEqual([
      { id: 'c1', name: 'Jane', email: 'jane@x.com', avatarColor: 'blue', company: undefined, notes: undefined },
    ]);
    expect(useCustomerStore.getState().status).toBe('loaded');
  });

  it('maps an image-bearing row, including avatar_url and image_type', async () => {
    const builder = makeQueryBuilder({
      data: [
        {
          id: 'c2',
          name: 'Bob',
          email: 'bob@x.com',
          avatar_color: 'mint',
          avatar_url: 'https://cdn.example.com/customers/user-1/c2/1.jpg',
          image_type: 'logo',
          company: 'Bob LLC',
          notes: null,
        },
      ],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useCustomerStore.getState().loadForUser('user-1');

    expect(useCustomerStore.getState().customers[0]).toMatchObject({
      avatarUrl: 'https://cdn.example.com/customers/user-1/c2/1.jpg',
      imageType: 'logo',
    });
  });

  it('sets a calm error on failure', async () => {
    const builder = makeQueryBuilder({ data: null, error: new Error('boom') });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useCustomerStore.getState().loadForUser('user-1');

    expect(useCustomerStore.getState().status).toBe('error');
    expect(useCustomerStore.getState().error).toBe("We couldn't load your customers. Try again.");
  });
});

describe('addCustomer', () => {
  it('inserts scoped to the user and cycles avatar colors by current count', async () => {
    useCustomerStore.setState({
      customers: [{ id: 'a', name: 'A', email: 'a@x.com', avatarColor: 'mint' }],
      status: 'loaded',
      error: null,
    });
    const builder = makeQueryBuilder({
      data: { id: 'c2', name: 'Bob', email: 'bob@x.com', avatar_color: 'lavender', company: null, notes: null },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    const result = await useCustomerStore.getState().addCustomer('user-1', { name: 'Bob', email: 'bob@x.com' });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', name: 'Bob', email: 'bob@x.com', avatar_color: 'lavender' })
    );
    expect(result.id).toBe('c2');
    expect(useCustomerStore.getState().customers).toHaveLength(2);
  });
});

describe('updateCustomer', () => {
  it('persists a new avatarUrl and imageType, scoped to both the customer and its owning user', async () => {
    useCustomerStore.setState({
      customers: [{ id: 'c1', name: 'Jane', email: 'jane@x.com', avatarColor: 'blue' }],
      status: 'loaded',
      error: null,
    });
    const builder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useCustomerStore.getState().updateCustomer('user-1', 'c1', {
      avatarUrl: 'https://cdn.example.com/customers/user-1/c1/1.jpg',
      imageType: 'photo',
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: 'https://cdn.example.com/customers/user-1/c1/1.jpg', image_type: 'photo' })
    );
    expect(builder.eq).toHaveBeenCalledWith('id', 'c1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(useCustomerStore.getState().customers[0].avatarUrl).toBe('https://cdn.example.com/customers/user-1/c1/1.jpg');
  });

  it('removing the image writes null for both columns, not just omitting them', async () => {
    useCustomerStore.setState({
      customers: [
        { id: 'c1', name: 'Jane', email: 'jane@x.com', avatarColor: 'blue', avatarUrl: 'https://cdn.example.com/old.jpg', imageType: 'photo' },
      ],
      status: 'loaded',
      error: null,
    });
    const builder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useCustomerStore.getState().updateCustomer('user-1', 'c1', { avatarUrl: undefined, imageType: undefined });

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ avatar_url: null, image_type: null }));
    expect(useCustomerStore.getState().customers[0].avatarUrl).toBeUndefined();
  });
});

describe('reset', () => {
  it('clears customers back to idle', () => {
    useCustomerStore.setState({
      customers: [{ id: 'a', name: 'A', email: 'a@x.com', avatarColor: 'mint' }],
      status: 'loaded',
      error: null,
    });
    useCustomerStore.getState().reset();
    expect(useCustomerStore.getState().customers).toEqual([]);
    expect(useCustomerStore.getState().status).toBe('idle');
  });

  it("does not leak User A's cached customers (or their photos/logos) into User B's session after a reset + reload", async () => {
    const userABuilder = makeQueryBuilder({
      data: [
        {
          id: 'a1',
          name: 'Alice Customer',
          email: 'a@x.com',
          avatar_color: 'blue',
          avatar_url: 'https://cdn.example.com/customers/user-A/a1/1.jpg',
          image_type: 'photo',
          company: null,
          notes: null,
        },
      ],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(userABuilder as never);
    await useCustomerStore.getState().loadForUser('user-A');
    expect(useCustomerStore.getState().customers).toHaveLength(1);

    useCustomerStore.getState().reset();
    expect(useCustomerStore.getState().customers).toEqual([]);

    const userBBuilder = makeQueryBuilder({ data: [], error: null });
    mockedSupabase.from.mockReturnValue(userBBuilder as never);
    await useCustomerStore.getState().loadForUser('user-B');

    expect(useCustomerStore.getState().customers).toEqual([]);
    expect(useCustomerStore.getState().customers.some((c) => c.name === 'Alice Customer')).toBe(false);
    expect(useCustomerStore.getState().customers.some((c) => c.avatarUrl?.includes('user-A'))).toBe(false);
  });
});
