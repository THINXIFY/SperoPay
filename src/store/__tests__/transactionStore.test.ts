jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useTransactionStore } from '../transactionStore';

const mockedSupabase = jest.mocked(supabase);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder as never;
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  useTransactionStore.setState({ transactions: [], status: 'idle', error: null });
});

describe('loadForUser', () => {
  it('loads and maps rows to the Transaction shape', async () => {
    const builder = makeQueryBuilder({
      data: [
        {
          id: 'tx1',
          payment_request_id: 'r1',
          from_customer_id: 'c1',
          amount: '100',
          currency: 'USDC',
          network: 'Solana',
          tx_hash: 'HASH',
          paid_at: '2026-08-21T00:00:00.000Z',
        },
      ],
      error: null,
    });
    mockedSupabase.from.mockReturnValue(builder as never);

    await useTransactionStore.getState().loadForUser('user-1');

    expect(useTransactionStore.getState().transactions).toEqual([
      {
        id: 'tx1',
        requestId: 'r1',
        amount: 100,
        currency: 'USDC',
        network: 'Solana',
        fromCustomerId: 'c1',
        txHash: 'HASH',
        paidAt: '2026-08-21T00:00:00.000Z',
      },
    ]);
  });
});

describe('getTransactionForRequest', () => {
  it('finds the transaction for a given request', () => {
    useTransactionStore.setState({
      transactions: [
        { id: 'tx1', requestId: 'r1', amount: 100, currency: 'USDC', network: 'Solana', fromCustomerId: 'c1', txHash: 'H1', paidAt: '2026-08-21T00:00:00.000Z' },
      ],
      status: 'loaded',
      error: null,
    });

    expect(useTransactionStore.getState().getTransactionForRequest('r1')?.id).toBe('tx1');
    expect(useTransactionStore.getState().getTransactionForRequest('r2')).toBeUndefined();
  });
});

describe('reset', () => {
  it('clears transactions back to idle', () => {
    useTransactionStore.setState({
      transactions: [{ id: 'tx1', requestId: 'r1', amount: 100, currency: 'USDC', network: 'Solana', fromCustomerId: 'c1', txHash: 'H1', paidAt: '2026-08-21T00:00:00.000Z' }],
      status: 'loaded',
      error: null,
    });
    useTransactionStore.getState().reset();
    expect(useTransactionStore.getState().transactions).toEqual([]);
    expect(useTransactionStore.getState().status).toBe('idle');
  });
});
