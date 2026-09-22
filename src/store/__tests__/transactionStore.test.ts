jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import { useMemo } from 'react';
import { renderHook, act } from '@testing-library/react-native';
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

describe('getTransactionsForRequest', () => {
  const tx1 = { id: 'tx1', requestId: 'r1', amount: 300, currency: 'USDC' as const, network: 'Solana' as const, fromCustomerId: 'c1', txHash: 'H1', paidAt: '2026-09-01T00:00:00.000Z' };
  const tx2 = { id: 'tx2', requestId: 'r1', amount: 700, currency: 'USDC' as const, network: 'Solana' as const, fromCustomerId: 'c1', txHash: 'H2', paidAt: '2026-09-10T00:00:00.000Z' };
  const txOther = { id: 'tx3', requestId: 'r2', amount: 50, currency: 'USDC' as const, network: 'Solana' as const, fromCustomerId: 'c1', txHash: 'H3', paidAt: '2026-09-05T00:00:00.000Z' };

  it("returns only the matching request's transactions, oldest first", () => {
    useTransactionStore.setState({ transactions: [tx2, txOther, tx1], status: 'loaded', error: null });
    const result = useTransactionStore.getState().getTransactionsForRequest('r1');
    expect(result.map((t) => t.id)).toEqual(['tx1', 'tx2']);
  });

  // Regression test for a real "Maximum update depth exceeded" crash on
  // Request Detail (app/(app)/requests/[id].tsx): this method does
  // `.filter().sort()`, which allocates a brand-new array on every call.
  // Wiring it directly into a `useTransactionStore(state => ...)` selector
  // meant the selector never compared equal to its own previous result, so
  // React's external-store subscription saw "changed" on every render,
  // forever. This test documents the exact property that makes that usage
  // dangerous -- if it ever stops being true, the danger is gone; if
  // something reintroduces the raw-selector usage, this failing would be
  // the wrong signal (it should still be true), so the real protection is
  // the render-stability test below.
  it('returns a new array reference on every call, even with completely unchanged state (why this must never back a selector directly)', () => {
    useTransactionStore.setState({ transactions: [tx1, tx2], status: 'loaded', error: null });
    const first = useTransactionStore.getState().getTransactionsForRequest('r1');
    const second = useTransactionStore.getState().getTransactionsForRequest('r1');
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  // The actual fix, proven directly: select the stable `transactions`
  // array and derive the per-request list with useMemo (exactly what
  // app/(app)/requests/[id].tsx now does) -- across a re-render with no
  // store change, the derived array must be the SAME reference, or the
  // exact infinite-loop condition above is back.
  it('[fix] selecting the stable transactions array and deriving with useMemo stays referentially stable across re-renders', async () => {
    useTransactionStore.setState({ transactions: [tx1, tx2, txOther], status: 'loaded', error: null });

    const { result, rerender } = await renderHook(() => {
      const transactions = useTransactionStore((state) => state.transactions);
      return useMemo(
        () => transactions.filter((t) => t.requestId === 'r1').sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime()),
        [transactions]
      );
    });

    const firstRender = result.current;
    expect(firstRender.map((t) => t.id)).toEqual(['tx1', 'tx2']);

    await act(async () => {
      rerender(undefined);
    });

    expect(result.current).toBe(firstRender); // same reference -- no unbounded re-render loop
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
