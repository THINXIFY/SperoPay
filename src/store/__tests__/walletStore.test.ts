jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useWalletStore } from '../walletStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.upsert = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useWalletStore.setState({ wallet: null, status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads the default wallet for the user', async () => {
    const builder = makeQueryBuilder({
      data: { network: 'Solana', stablecoin: 'USDC', address: '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu' },
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useWalletStore.getState().loadForUser('user-1');

    expect(useWalletStore.getState().wallet).toEqual({
      network: 'Solana',
      stablecoin: 'USDC',
      address: '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu',
    });
    expect(useWalletStore.getState().status).toBe('loaded');
  });

  it('leaves wallet null when the user has none yet', async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useWalletStore.getState().loadForUser('user-1');

    expect(useWalletStore.getState().wallet).toBeNull();
    expect(useWalletStore.getState().status).toBe('loaded');
  });
});

describe('setWalletAddress', () => {
  it('upserts on user_id so V1 stays single-wallet-per-user', async () => {
    const builder = makeQueryBuilder({ data: {}, error: null });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useWalletStore.getState().setWalletAddress('user-1', 'NewAddress111111111111111111111111111');

    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        address: 'NewAddress111111111111111111111111111',
        network: 'Solana',
        stablecoin: 'USDC',
        is_default: true,
      }),
      { onConflict: 'user_id' }
    );
    expect(useWalletStore.getState().wallet?.address).toBe('NewAddress111111111111111111111111111');
  });
});

describe('reset', () => {
  it('clears wallet back to idle', () => {
    useWalletStore.setState({ wallet: { network: 'Solana', stablecoin: 'USDC', address: 'x' }, status: 'loaded', error: null });
    useWalletStore.getState().reset();
    expect(useWalletStore.getState().wallet).toBeNull();
    expect(useWalletStore.getState().status).toBe('idle');
  });
});
