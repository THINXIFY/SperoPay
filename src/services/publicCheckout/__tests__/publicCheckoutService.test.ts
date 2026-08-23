jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import { supabase } from '../../../lib/supabase';
import { fetchPublicCheckout, isValidPublicToken } from '../publicCheckoutService';

const mockedSupabase = jest.mocked(supabase);

const VALID_TOKEN = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    payment_code: 'SP-AAAAA',
    amount: '10.50',
    currency: 'USDC',
    network: 'Solana',
    description: 'Website design',
    status: 'pending',
    expires_at: '2026-09-01T00:00:00.000Z',
    merchant_name: 'Acme Co',
    destination_wallet: '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu',
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
    expect(isValidPublicToken('')).toBe(false);
    expect(isValidPublicToken('SP-AAAAA')).toBe(false); // the OLD weak identifier must never be accepted here
  });
});

describe('fetchPublicCheckout', () => {
  it('rejects a malformed token before ever calling Supabase', async () => {
    const result = await fetchPublicCheckout('not-a-token');

    expect(result).toEqual({ ok: false, code: 'invalid_token', message: expect.any(String) });
    expect(mockedSupabase.rpc).not.toHaveBeenCalled();
  });

  it('returns normalized data for a valid token with a matching row', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: [rpcRow()], error: null } as never);

    const result = await fetchPublicCheckout(VALID_TOKEN);

    expect(mockedSupabase.rpc).toHaveBeenCalledWith('get_public_payment_request', { p_token: VALID_TOKEN });
    expect(result).toEqual({
      ok: true,
      data: {
        paymentCode: 'SP-AAAAA',
        amount: 10.5,
        currency: 'USDC',
        network: 'Solana',
        description: 'Website design',
        status: 'pending',
        expiresAt: '2026-09-01T00:00:00.000Z',
        merchantName: 'Acme Co',
        destinationWallet: '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu',
      },
    });
  });

  it('returns not_found when the RPC returns an empty result (valid token, no matching request)', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: [], error: null } as never);

    const result = await fetchPublicCheckout(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'not_found', message: expect.any(String) });
  });

  it('returns not_found when the RPC returns null data', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

    const result = await fetchPublicCheckout(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'not_found', message: expect.any(String) });
  });

  it('returns network_error (not a raw error) when the RPC call fails', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied for table x' } } as never);

    const result = await fetchPublicCheckout(VALID_TOKEN);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('network_error');
      expect(result.message).not.toMatch(/permission denied/); // never leak the raw Supabase error
    }
  });

  it('returns network_error when the RPC call throws', async () => {
    mockedSupabase.rpc.mockRejectedValue(new Error('fetch failed'));

    const result = await fetchPublicCheckout(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'network_error', message: expect.any(String) });
  });

  it('never exposes a field beyond what the RPC actually returns (privacy)', async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [{ ...rpcRow(), id: 'row-internal-id', user_id: 'owner-uuid', customer_id: 'cust-uuid' }],
      error: null,
    } as never);

    const result = await fetchPublicCheckout(VALID_TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const keys = Object.keys(result.data);
      expect(keys).not.toContain('id');
      expect(keys).not.toContain('userId');
      expect(keys).not.toContain('customerId');
      expect(keys.sort()).toEqual(
        [
          'paymentCode',
          'amount',
          'currency',
          'network',
          'description',
          'status',
          'expiresAt',
          'merchantName',
          'destinationWallet',
        ].sort()
      );
    }
  });
});
