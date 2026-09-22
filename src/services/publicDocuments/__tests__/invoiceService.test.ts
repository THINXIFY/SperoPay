jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import { supabase } from '../../../lib/supabase';
import { fetchPublicInvoice, isValidPublicToken } from '../invoiceService';

const mockedSupabase = jest.mocked(supabase);

const VALID_TOKEN = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    payment_code: 'SP-AAAAA',
    amount: '500.00',
    currency: 'USDC',
    network: 'Solana',
    description: 'Website Maintenance',
    status: 'pending',
    created_at: '2026-08-01T00:00:00.000Z',
    due_at: '2026-09-10T00:00:00.000Z',
    expires_at: null,
    merchant_name: 'Acme Studio',
    merchant_logo_url: 'https://example.com/logo.png',
    customer_name: 'Alex Morgan',
    allow_partial_payments: false,
    deposit_type: null,
    deposit_value: null,
    verified_paid_amount: '0',
    remaining_amount: '500.00',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isValidPublicToken', () => {
  it('accepts a well-formed UUID', () => {
    expect(isValidPublicToken(VALID_TOKEN)).toBe(true);
  });

  it('rejects a malformed token', () => {
    expect(isValidPublicToken('not-a-token')).toBe(false);
    expect(isValidPublicToken('SP-AAAAA')).toBe(false);
  });
});

describe('fetchPublicInvoice', () => {
  it('rejects a malformed token before ever calling Supabase', async () => {
    const result = await fetchPublicInvoice('not-a-token');

    expect(result).toEqual({ ok: false, code: 'invalid_token', message: expect.any(String) });
    expect(mockedSupabase.rpc).not.toHaveBeenCalled();
  });

  it('returns normalized data for a valid token with a matching row', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: [rpcRow()], error: null } as never);

    const result = await fetchPublicInvoice(VALID_TOKEN);

    expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_public_invoice', { p_token: VALID_TOKEN });
    expect(result).toEqual({
      ok: true,
      data: {
        paymentCode: 'SP-AAAAA',
        amount: 500,
        currency: 'USDC',
        network: 'Solana',
        description: 'Website Maintenance',
        status: 'pending',
        createdAt: '2026-08-01T00:00:00.000Z',
        dueAt: '2026-09-10T00:00:00.000Z',
        expiresAt: null,
        merchantName: 'Acme Studio',
        merchantLogoUrl: 'https://example.com/logo.png',
        customerName: 'Alex Morgan',
        allowPartialPayments: false,
        depositType: null,
        depositValue: null,
        verifiedPaidAmount: 0,
        remainingAmount: 500,
      },
    });
  });

  it('returns not_found when the RPC returns an empty result', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: [], error: null } as never);

    const result = await fetchPublicInvoice(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'not_found', message: expect.any(String) });
  });

  it('fails closed with network_error when the RPC returns an unrecognized status', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: [rpcRow({ status: 'some_future_status' })], error: null } as never);

    const result = await fetchPublicInvoice(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'network_error', message: expect.any(String) });
  });

  it('returns network_error (not a raw error) when the RPC call fails', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied for table x' } } as never);

    const result = await fetchPublicInvoice(VALID_TOKEN);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('network_error');
      expect(result.message).not.toMatch(/permission denied/);
    }
  });

  it('returns network_error when the RPC call throws', async () => {
    mockedSupabase.rpc.mockRejectedValue(new Error('fetch failed'));

    const result = await fetchPublicInvoice(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'network_error', message: expect.any(String) });
  });

  it('never exposes a field beyond what the RPC actually returns (privacy)', async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [{ ...rpcRow(), id: 'row-internal-id', user_id: 'owner-uuid', customer_id: 'cust-uuid', note: 'internal-only note' }],
      error: null,
    } as never);

    const result = await fetchPublicInvoice(VALID_TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const keys = Object.keys(result.data);
      expect(keys).not.toContain('id');
      expect(keys).not.toContain('userId');
      expect(keys).not.toContain('customerId');
      expect(keys).not.toContain('note');
      expect(keys.sort()).toEqual(
        [
          'paymentCode',
          'amount',
          'currency',
          'network',
          'description',
          'status',
          'createdAt',
          'dueAt',
          'expiresAt',
          'merchantName',
          'merchantLogoUrl',
          'customerName',
          'allowPartialPayments',
          'depositType',
          'depositValue',
          'verifiedPaidAmount',
          'remainingAmount',
        ].sort()
      );
    }
  });
});
