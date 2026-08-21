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
      expect.objectContaining({ p_amount: 100, p_customer_id: 'c1', p_expiry_option: '7d' })
    );
    expect(request.id).toBe('r1');
    expect(request.paymentCode).toBe('SP-AAAAA');
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

  it('completePayment on success updates status to paid and caches the transaction', async () => {
    useRequestStore.setState({
      requests: [makePaymentRequestForStore('r1', 'confirming')],
      isCreating: false,
      status: 'loaded',
      error: null,
    });
    mockedSupabase.rpc.mockResolvedValue({
      data: {
        id: 'tx1',
        payment_request_id: 'r1',
        from_customer_id: 'c1',
        amount: '100',
        currency: 'USDC',
        network: 'Solana',
        tx_hash: 'HASH',
        paid_at: '2026-08-21T00:00:00.000Z',
      },
      error: null,
    } as never);

    const transaction = await useRequestStore.getState().completePayment('user-1', 'r1', { forceFailure: false });

    expect(transaction?.id).toBe('tx1');
    expect(useRequestStore.getState().requests[0].status).toBe('paid');
    expect(useTransactionStore.getState().transactions).toHaveLength(1);
  });

  it('completePayment on forced failure reverts status to pending and returns null', async () => {
    useRequestStore.setState({
      requests: [makePaymentRequestForStore('r1', 'confirming')],
      isCreating: false,
      status: 'loaded',
      error: null,
    });
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

    const transaction = await useRequestStore.getState().completePayment('user-1', 'r1', { forceFailure: true });

    expect(transaction).toBeNull();
    expect(useRequestStore.getState().requests[0].status).toBe('pending');
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
