jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import { supabase } from '../../../lib/supabase';
import { fetchPublicReceipt } from '../receiptService';

const mockedSupabase = jest.mocked(supabase);

const VALID_TOKEN = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

const INVOICE_ROW = {
  payment_code: 'SP-AAAAA',
  currency: 'USDC',
  description: 'Website Maintenance',
  status: 'paid',
  due_at: null,
  merchant_name: 'Acme Studio',
  merchant_logo_url: null,
  customer_name: 'Alex Morgan',
  network: 'Solana',
  amount: '500.00',
  verified_paid_amount: '500.00',
  remaining_amount: '0',
};

const PAYMENT_ROW = { amount: '500.00', currency: 'USDC', paid_at: '2026-09-03T00:00:00.000Z', tx_hash: 'hash-abc' };

function mockRpcResponses(overrides: {
  invoice?: { data: unknown; error: unknown };
  payments?: { data: unknown; error: unknown };
}) {
  const invoice = overrides.invoice ?? { data: [INVOICE_ROW], error: null };
  const payments = overrides.payments ?? { data: [PAYMENT_ROW], error: null };

  mockedSupabase.rpc.mockImplementation((fn: string) => {
    switch (fn) {
      case 'get_public_invoice':
        return Promise.resolve(invoice) as never;
      case 'get_public_receipt':
        return Promise.resolve(payments) as never;
      default:
        throw new Error(`unexpected rpc: ${fn}`);
    }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchPublicReceipt', () => {
  it('rejects a malformed token before ever calling Supabase', async () => {
    const result = await fetchPublicReceipt('not-a-token');

    expect(result).toEqual({ ok: false, code: 'invalid_token', message: expect.any(String) });
    expect(mockedSupabase.rpc).not.toHaveBeenCalled();
  });

  it('returns normalized data composed from both RPCs when payments exist', async () => {
    mockRpcResponses({});

    const result = await fetchPublicReceipt(VALID_TOKEN);

    expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_public_invoice', { p_token: VALID_TOKEN });
    expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_public_receipt', { p_token: VALID_TOKEN });
    expect(result).toEqual({
      ok: true,
      data: {
        paymentCode: 'SP-AAAAA',
        description: 'Website Maintenance',
        merchantName: 'Acme Studio',
        merchantLogoUrl: null,
        customerName: 'Alex Morgan',
        network: 'Solana',
        currency: 'USDC',
        status: 'paid',
        dueAt: null,
        totalAmount: 500,
        verifiedPaidAmount: 500,
        remainingAmount: 0,
        payments: [{ amount: 500, currency: 'USDC', paidAt: '2026-09-03T00:00:00.000Z', txHash: 'hash-abc' }],
      },
    });
  });

  it('returns ok:true with an empty payments array when the request exists but nothing has been paid yet', async () => {
    mockRpcResponses({
      invoice: { data: [{ ...INVOICE_ROW, status: 'pending', verified_paid_amount: '0', remaining_amount: '500.00' }], error: null },
      payments: { data: [], error: null },
    });

    const result = await fetchPublicReceipt(VALID_TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.payments).toEqual([]);
      expect(result.data.status).toBe('pending');
    }
  });

  it('returns multiple payment lines for a partially-paid request with more than one transaction', async () => {
    mockRpcResponses({
      payments: {
        data: [
          { amount: '200.00', currency: 'USDC', paid_at: '2026-09-01T00:00:00.000Z', tx_hash: 'hash-1' },
          { amount: '300.00', currency: 'USDC', paid_at: '2026-09-03T00:00:00.000Z', tx_hash: 'hash-2' },
        ],
        error: null,
      },
    });

    const result = await fetchPublicReceipt(VALID_TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.payments).toHaveLength(2);
      expect(result.data.payments.map((p) => p.txHash)).toEqual(['hash-1', 'hash-2']);
    }
  });

  it('returns not_found when the invoice RPC returns an empty result (invalid token)', async () => {
    mockRpcResponses({ invoice: { data: [], error: null } });

    const result = await fetchPublicReceipt(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'not_found', message: expect.any(String) });
  });

  it('fails closed with network_error on an unrecognized status', async () => {
    mockRpcResponses({ invoice: { data: [{ ...INVOICE_ROW, status: 'some_future_status' }], error: null } });

    const result = await fetchPublicReceipt(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'network_error', message: expect.any(String) });
  });

  it('returns network_error (not a raw error) when either RPC call fails', async () => {
    mockRpcResponses({ invoice: { data: null, error: { message: 'permission denied' } } });

    const result = await fetchPublicReceipt(VALID_TOKEN);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('network_error');
      expect(result.message).not.toMatch(/permission denied/);
    }
  });

  it('returns network_error when either RPC call throws', async () => {
    mockedSupabase.rpc.mockRejectedValue(new Error('fetch failed'));

    const result = await fetchPublicReceipt(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'network_error', message: expect.any(String) });
  });

  it('never exposes a field beyond the normalized shape (privacy)', async () => {
    mockRpcResponses({
      invoice: { data: [{ ...INVOICE_ROW, id: 'row-id', user_id: 'owner-uuid' }], error: null },
      payments: { data: [{ ...PAYMENT_ROW, id: 'txn-id', payment_request_id: 'req-id' }], error: null },
    });

    const result = await fetchPublicReceipt(VALID_TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data)).not.toContain('id');
      expect(Object.keys(result.data.payments[0])).not.toContain('id');
      expect(Object.keys(result.data.payments[0])).not.toContain('paymentRequestId');
      expect(Object.keys(result.data.payments[0]).sort()).toEqual(['amount', 'currency', 'paidAt', 'txHash'].sort());
    }
  });
});
