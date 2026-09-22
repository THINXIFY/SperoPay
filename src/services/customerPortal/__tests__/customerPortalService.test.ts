jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import { supabase } from '../../../lib/supabase';
import { fetchCustomerPortal, isValidPortalToken } from '../customerPortalService';

const mockedSupabase = jest.mocked(supabase);

const VALID_TOKEN = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

const IDENTITY_ROW = { merchant_name: 'Acme Studio', merchant_logo_url: null, customer_name: 'Alex Morgan' };
const REQUEST_ROW = {
  request_public_token: 'req-token-1',
  payment_code: 'SP-AAAAA',
  description: 'Website Maintenance',
  amount: '500',
  currency: 'USDC',
  network: 'Solana',
  status: 'pending',
  due_at: '2026-09-10T00:00:00.000Z',
  expires_at: null,
  created_at: '2026-08-01T00:00:00.000Z',
  allow_partial_payments: false,
  deposit_type: null,
  deposit_value: null,
  verified_paid_amount: '0',
  remaining_amount: '500',
};
const PAYMENT_ROW = {
  request_public_token: 'req-token-1',
  request_description: 'Website Maintenance',
  amount: '300',
  currency: 'USDC',
  tx_hash: 'hash-abc',
  paid_at: '2026-09-03T00:00:00.000Z',
};
const RECURRING_ROW = {
  description: 'Website Maintenance',
  amount: '500',
  currency: 'USDC',
  frequency: 'monthly',
  custom_interval_days: null,
  next_run_at: '2026-10-01T00:00:00.000Z',
};

function mockRpcResponses(overrides: {
  identity?: { data: unknown; error: unknown };
  requests?: { data: unknown; error: unknown };
  payments?: { data: unknown; error: unknown };
  recurring?: { data: unknown; error: unknown };
}) {
  const identity = overrides.identity ?? { data: [IDENTITY_ROW], error: null };
  const requests = overrides.requests ?? { data: [REQUEST_ROW], error: null };
  const payments = overrides.payments ?? { data: [PAYMENT_ROW], error: null };
  const recurring = overrides.recurring ?? { data: [RECURRING_ROW], error: null };

  mockedSupabase.rpc.mockImplementation((fn: string) => {
    switch (fn) {
      case 'get_customer_portal':
        return Promise.resolve(identity) as never;
      case 'get_customer_portal_requests':
        return Promise.resolve(requests) as never;
      case 'get_customer_portal_payments':
        return Promise.resolve(payments) as never;
      case 'get_customer_portal_recurring':
        return Promise.resolve(recurring) as never;
      default:
        throw new Error(`unexpected rpc: ${fn}`);
    }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isValidPortalToken', () => {
  it('accepts a well-formed UUID and rejects everything else', () => {
    expect(isValidPortalToken(VALID_TOKEN)).toBe(true);
    expect(isValidPortalToken('not-a-token')).toBe(false);
    expect(isValidPortalToken('')).toBe(false);
  });
});

describe('fetchCustomerPortal', () => {
  it('rejects a malformed token before calling Supabase at all', async () => {
    const result = await fetchCustomerPortal('not-a-token');
    expect(result).toEqual({ ok: false, code: 'invalid_token', message: expect.any(String) });
    expect(mockedSupabase.rpc).not.toHaveBeenCalled();
  });

  it('composes all four RPC results into one sanitized shape for a valid token', async () => {
    mockRpcResponses({});

    const result = await fetchCustomerPortal(VALID_TOKEN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.identity).toEqual({ merchantName: 'Acme Studio', merchantLogoUrl: null, customerName: 'Alex Morgan' });
    expect(result.data.requests).toHaveLength(1);
    expect(result.data.requests[0]).toEqual({
      publicToken: 'req-token-1',
      paymentCode: 'SP-AAAAA',
      description: 'Website Maintenance',
      amount: 500,
      currency: 'USDC',
      network: 'Solana',
      status: 'pending',
      dueAt: '2026-09-10T00:00:00.000Z',
      expiresAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      allowPartialPayments: false,
      depositType: null,
      depositValue: null,
      verifiedPaidAmount: 0,
      remainingAmount: 500,
    });
    expect(result.data.payments).toHaveLength(1);
    expect(result.data.recurring).toHaveLength(1);

    // Every one of the four RPCs is called with the SAME token -- never a
    // customer id, request id, or anything derived from a prior call.
    for (const call of mockedSupabase.rpc.mock.calls) {
      expect(call[1]).toEqual({ p_token: VALID_TOKEN });
    }
  });

  it('returns not_found when the token matches no customer (empty identity)', async () => {
    mockRpcResponses({ identity: { data: [], error: null } });

    const result = await fetchCustomerPortal(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'not_found', message: expect.any(String) });
  });

  it('returns network_error (never a raw error) when any RPC fails', async () => {
    mockRpcResponses({ payments: { data: null, error: { message: 'permission denied for table transactions' } } });

    const result = await fetchCustomerPortal(VALID_TOKEN);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('network_error');
    expect(result.message).not.toMatch(/permission denied/);
  });

  it('returns network_error when a call throws outright', async () => {
    mockedSupabase.rpc.mockRejectedValue(new Error('network down'));

    const result = await fetchCustomerPortal(VALID_TOKEN);

    expect(result).toEqual({ ok: false, code: 'network_error', message: expect.any(String) });
  });

  it('never exposes a field beyond what each RPC actually returns (privacy)', async () => {
    mockRpcResponses({
      identity: { data: [{ ...IDENTITY_ROW, id: 'customer-internal-id', user_id: 'merchant-uuid' }], error: null },
    });

    const result = await fetchCustomerPortal(VALID_TOKEN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const identityKeys = Object.keys(result.data.identity);
    expect(identityKeys).not.toContain('id');
    expect(identityKeys).not.toContain('userId');
    expect(identityKeys.sort()).toEqual(['customerName', 'merchantLogoUrl', 'merchantName'].sort());

    const requestKeys = Object.keys(result.data.requests[0]);
    expect(requestKeys).not.toContain('id');
    expect(requestKeys).not.toContain('customerId');
    expect(requestKeys).not.toContain('userId');
  });
});
