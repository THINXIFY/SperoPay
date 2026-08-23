jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useRequestStore } from '../requestStore';
import { useRequestEventStore } from '../requestEventStore';
import { useTransactionStore } from '../transactionStore';

const mockedSupabase = jest.mocked(supabase);

function mapRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    customer_id: 'c1',
    wallet_id: null,
    payment_code: 'SP-AAAAA',
    amount: '100',
    currency: 'USDC',
    network: 'Solana',
    description: null,
    note: null,
    expiry_option: '7d',
    expires_at: null,
    status: 'pending',
    payment_link: 'https://pay.speropay.app/r/SP-AAAAA',
    public_token: 'test-public-token-1',
    solana_reference: 'test-solana-reference-1',
    created_at: '2026-08-21T00:00:00.000Z',
    ...overrides,
  };
}

function makePaymentRequestForStore(id: string, status: string) {
  return {
    id,
    paymentCode: 'SP-AAAAA',
    amount: 100,
    currency: 'USDC' as const,
    network: 'Solana' as const,
    customerId: 'c1',
    expiryOption: '7d' as const,
    expiresAt: null,
    status: status as never,
    createdAt: '2026-08-21T00:00:00.000Z',
    paymentLink: 'https://pay.speropay.app/r/SP-AAAAA',
    publicToken: 'test-public-token-1',
    solanaReference: 'test-solana-reference-1',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useRequestStore.setState({ requests: [], isCreating: false, status: 'idle', error: null });
  useRequestEventStore.setState({ events: [], status: 'idle', error: null });
  useTransactionStore.setState({ transactions: [], status: 'idle', error: null });
});

describe('createRequest', () => {
  it('calls the create_payment_request RPC and prepends the mapped result', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: mapRequestRow(), error: null } as never);

    const request = await useRequestStore.getState().createRequest('user-1', {
      amount: 100,
      customerId: 'c1',
      expiryOption: '7d',
    });

    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      'create_payment_request',
      expect.objectContaining({ p_amount: 100, p_customer_id: 'c1', p_expiry_option: '7d', p_solana_reference: expect.any(String) })
    );
    expect(request.id).toBe('r1');
    expect(request.paymentCode).toBe('SP-AAAAA');
    expect(request.solanaReference).toBe('test-solana-reference-1');
    expect(useRequestStore.getState().requests).toHaveLength(1);
  });
});

describe('beginPaymentConfirmation / completePayment', () => {
  it('begin calls the RPC and returns its boolean result', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: true, error: null } as never);
    useRequestStore.setState({
      requests: [makePaymentRequestForStore('r1', 'pending')],
      isCreating: false,
      status: 'loaded',
      error: null,
    });

    const result = await useRequestStore.getState().beginPaymentConfirmation('user-1', 'r1');

    expect(result).toBe(true);
    expect(mockedSupabase.rpc).toHaveBeenCalledWith('begin_payment_confirmation', { p_request_id: 'r1' });
    expect(useRequestStore.getState().requests[0].status).toBe('confirming');
  });

  it('completePayment on success updates status to paid and caches the transaction (setof array shape)', async () => {
    useRequestStore.setState({
      requests: [makePaymentRequestForStore('r1', 'confirming')],
      isCreating: false,
      status: 'loaded',
      error: null,
    });
    // complete_payment is `returns setof public.transactions` — PostgREST
    // delivers this as an array, not a bare object.
    mockedSupabase.rpc.mockResolvedValue({
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
    } as never);

    const transaction = await useRequestStore.getState().completePayment('user-1', 'r1', { forceFailure: false });

    expect(transaction?.id).toBe('tx1');
    expect(useRequestStore.getState().requests[0].status).toBe('paid');
    expect(useTransactionStore.getState().transactions).toHaveLength(1);
  });

  it('completePayment on forced failure reverts status to pending and returns null (empty setof array)', async () => {
    useRequestStore.setState({
      requests: [makePaymentRequestForStore('r1', 'confirming')],
      isCreating: false,
      status: 'loaded',
      error: null,
    });
    mockedSupabase.rpc.mockResolvedValue({ data: [], error: null } as never);

    const transaction = await useRequestStore.getState().completePayment('user-1', 'r1', { forceFailure: true });

    expect(transaction).toBeNull();
    expect(useRequestStore.getState().requests[0].status).toBe('pending');
  });

  it('treats an all-null composite object as failure too, not just an empty array or null', async () => {
    // Defensive coverage for the exact bug the setof fix closes: if a
    // non-setof function ever returns a NULL composite, PostgREST delivers
    // one row of all-null columns — truthy under a naive `if (!data)` check.
    useRequestStore.setState({
      requests: [makePaymentRequestForStore('r1', 'confirming')],
      isCreating: false,
      status: 'loaded',
      error: null,
    });
    mockedSupabase.rpc.mockResolvedValue({
      data: { id: null, payment_request_id: null, amount: null, tx_hash: null },
      error: null,
    } as never);

    const transaction = await useRequestStore.getState().completePayment('user-1', 'r1', { forceFailure: true });

    expect(transaction).toBeNull();
    expect(useRequestStore.getState().requests[0].status).toBe('pending');
  });
});

describe('stale-response guard', () => {
  it('a loadForUser that resolves after a mutation does not overwrite the mutation', async () => {
    let resolveLoad: (value: { data: unknown; error: null }) => void = () => {};
    const stalledSelect = new Promise((resolve) => {
      resolveLoad = resolve;
    });
    const selectBuilder: Record<string, jest.Mock> = {};
    selectBuilder.select = jest.fn(() => selectBuilder);
    selectBuilder.eq = jest.fn(() => selectBuilder);
    selectBuilder.order = jest.fn(() => stalledSelect);
    mockedSupabase.from.mockReturnValue(selectBuilder as never);

    const load = useRequestStore.getState().loadForUser('user-1');

    mockedSupabase.rpc.mockResolvedValue({ data: mapRequestRow({ id: 'r-new' }), error: null } as never);
    await useRequestStore.getState().createRequest('user-1', { amount: 50, expiryOption: '7d' });
    expect(useRequestStore.getState().requests).toHaveLength(1);

    // The stalled loadForUser (issued before the create) finally resolves
    // with an empty list — it must not wipe out the optimistically-added request.
    resolveLoad({ data: [], error: null });
    await load;

    expect(useRequestStore.getState().requests).toHaveLength(1);
    expect(useRequestStore.getState().requests[0].id).toBe('r-new');
  });
});

describe('reset', () => {
  it('clears requests back to idle', () => {
    useRequestStore.setState({
      requests: [makePaymentRequestForStore('r1', 'pending')],
      isCreating: false,
      status: 'loaded',
      error: null,
    });
    useRequestStore.getState().reset();
    expect(useRequestStore.getState().requests).toEqual([]);
    expect(useRequestStore.getState().status).toBe('idle');
  });
});
