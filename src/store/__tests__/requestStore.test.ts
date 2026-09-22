jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import { useRequestStore } from '../requestStore';
import { useRequestEventStore } from '../requestEventStore';
import { useTransactionStore } from '../transactionStore';
import type { PaymentRequest } from '../../types';

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

describe('creating multiple independent requests', () => {
  it('same customer, three requests: all three persist as distinct rows', async () => {
    mockedSupabase.rpc
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'r1', amount: '5', public_token: 'tok1', solana_reference: 'ref1' }), error: null } as never)
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'r2', amount: '10', public_token: 'tok2', solana_reference: 'ref2' }), error: null } as never)
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'r3', amount: '5', public_token: 'tok3', solana_reference: 'ref3' }), error: null } as never);

    const req1 = await useRequestStore.getState().createRequest('user-1', { amount: 5, customerId: 'c1', expiryOption: '7d' });
    const req2 = await useRequestStore.getState().createRequest('user-1', { amount: 10, customerId: 'c1', expiryOption: '7d' });
    const req3 = await useRequestStore.getState().createRequest('user-1', { amount: 5, customerId: 'c1', expiryOption: '7d' });

    const ids = useRequestStore.getState().requests.map((r) => r.id);
    expect(ids).toEqual(['r3', 'r2', 'r1']); // newest first, all three present
    expect(new Set(ids).size).toBe(3);
    // The two $5 requests (req1, req3) are genuinely independent rows, not
    // one request that got updated twice.
    expect(req1.id).not.toBe(req3.id);
  });

  it('different customers: each request appears independently', async () => {
    mockedSupabase.rpc
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'rA', customer_id: 'cA' }), error: null } as never)
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'rB', customer_id: 'cB' }), error: null } as never)
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'rC', customer_id: 'cC' }), error: null } as never);

    await useRequestStore.getState().createRequest('user-1', { amount: 5, customerId: 'cA', expiryOption: '7d' });
    await useRequestStore.getState().createRequest('user-1', { amount: 5, customerId: 'cB', expiryOption: '7d' });
    await useRequestStore.getState().createRequest('user-1', { amount: 5, customerId: 'cC', expiryOption: '7d' });

    const customerIds = useRequestStore.getState().requests.map((r) => r.customerId).sort();
    expect(customerIds).toEqual(['cA', 'cB', 'cC']);
  });

  it('rapid sequential creation (no await gap) still results in both requests', async () => {
    mockedSupabase.rpc
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'r1' }), error: null } as never)
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'r2' }), error: null } as never);

    const [req1, req2] = await Promise.all([
      useRequestStore.getState().createRequest('user-1', { amount: 5, expiryOption: '7d' }),
      useRequestStore.getState().createRequest('user-1', { amount: 10, expiryOption: '7d' }),
    ]);

    expect(req1.id).not.toBe(req2.id);
    expect(useRequestStore.getState().requests).toHaveLength(2);
  });

  it('every created request gets its own public_token and solana_reference -- never shared', async () => {
    mockedSupabase.rpc
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'r1', public_token: 'tok1', solana_reference: 'ref1' }), error: null } as never)
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'r2', public_token: 'tok2', solana_reference: 'ref2' }), error: null } as never);

    const req1 = await useRequestStore.getState().createRequest('user-1', { amount: 5, expiryOption: '7d' });
    const req2 = await useRequestStore.getState().createRequest('user-1', { amount: 5, expiryOption: '7d' });

    expect(req1.publicToken).not.toBe(req2.publicToken);
    expect(req1.solanaReference).not.toBe(req2.solanaReference);
    // Each individual createRequest call also builds a fresh client-side
    // payment_code/solana_reference pair per attempt -- assert the RPC was
    // actually invoked with two different p_solana_reference values, not
    // just that the (server-returned) rows differ.
    const calls = mockedSupabase.rpc.mock.calls;
    expect(calls[0][1]).toMatchObject({ p_solana_reference: expect.any(String) });
    expect(calls[1][1]).toMatchObject({ p_solana_reference: expect.any(String) });
    expect((calls[0][1] as { p_solana_reference: string }).p_solana_reference).not.toBe(
      (calls[1][1] as { p_solana_reference: string }).p_solana_reference
    );
  });

  it('retries with a freshly-generated payload on a payment_code collision (23505), instead of failing permanently', async () => {
    mockedSupabase.rpc
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "payment_requests_payment_code_key"' } } as never)
      .mockResolvedValueOnce({ data: mapRequestRow({ id: 'r-retry' }), error: null } as never);

    const request = await useRequestStore.getState().createRequest('user-1', { amount: 5, expiryOption: '7d' });

    expect(request.id).toBe('r-retry');
    expect(mockedSupabase.rpc).toHaveBeenCalledTimes(2);
    // The retried attempt must use a DIFFERENT generated payment_code/
    // reference, not resubmit the exact same (already-colliding) values.
    const [firstCallArgs, secondCallArgs] = mockedSupabase.rpc.mock.calls.map((call) => call[1] as { p_payment_code: string });
    expect(firstCallArgs.p_payment_code).not.toBe(secondCallArgs.p_payment_code);
    expect(useRequestStore.getState().isCreating).toBe(false);
  });

  it('does not retry (and surfaces the error) for a non-collision failure', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } } as never);

    await expect(useRequestStore.getState().createRequest('user-1', { amount: 5, expiryOption: '7d' })).rejects.toBeTruthy();

    expect(mockedSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(useRequestStore.getState().isCreating).toBe(false);
    expect(useRequestStore.getState().requests).toHaveLength(0);
  });

  it('gives up after MAX_ATTEMPTS repeated collisions rather than retrying forever', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } } as never);

    await expect(useRequestStore.getState().createRequest('user-1', { amount: 5, expiryOption: '7d' })).rejects.toBeTruthy();

    expect(mockedSupabase.rpc).toHaveBeenCalledTimes(3);
    expect(useRequestStore.getState().isCreating).toBe(false);
  });
});

describe('store hydration (loadForUser) with multiple existing requests', () => {
  it('loads every row for the user, not just one', async () => {
    const selectBuilder: Record<string, jest.Mock> = {};
    selectBuilder.select = jest.fn(() => selectBuilder);
    selectBuilder.eq = jest.fn(() => selectBuilder);
    selectBuilder.order = jest.fn(() =>
      Promise.resolve({
        data: [mapRequestRow({ id: 'r3' }), mapRequestRow({ id: 'r2' }), mapRequestRow({ id: 'r1' })],
        error: null,
      })
    );
    mockedSupabase.from.mockReturnValue(selectBuilder as never);

    await useRequestStore.getState().loadForUser('user-1');

    expect(useRequestStore.getState().requests.map((r) => r.id)).toEqual(['r3', 'r2', 'r1']);
    expect(useRequestStore.getState().status).toBe('loaded');
  });

  it('a fresh loadForUser after reset (the sign-out/sign-in equivalent) still returns every request', async () => {
    const selectBuilder: Record<string, jest.Mock> = {};
    selectBuilder.select = jest.fn(() => selectBuilder);
    selectBuilder.eq = jest.fn(() => selectBuilder);
    selectBuilder.order = jest.fn(() =>
      Promise.resolve({ data: [mapRequestRow({ id: 'r1' }), mapRequestRow({ id: 'r2' })], error: null })
    );
    mockedSupabase.from.mockReturnValue(selectBuilder as never);

    await useRequestStore.getState().loadForUser('user-1');
    expect(useRequestStore.getState().requests).toHaveLength(2);

    // Simulates sign-out: dataLifecycle's reset, wiping the in-memory store.
    useRequestStore.getState().reset();
    expect(useRequestStore.getState().requests).toHaveLength(0);

    // Sign back in -- a fresh loadForUser must recover both requests again.
    await useRequestStore.getState().loadForUser('user-1');
    expect(useRequestStore.getState().requests.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
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

// Phase 5D security audit: deleteRequest is the one place this store does
// a raw table delete (every other mutation goes through an RPC) -- RLS is
// the real, database-level enforcement of "only your own row" (see
// payment_requests_delete_own, migration 0002), but the client is also
// expected to never even attempt a delete scoped to someone else's rows.
// This proves the query itself is built with BOTH the target id and the
// calling user's own id, not just the id -- an insecure-direct-object-
// reference regression here (e.g. a future refactor dropping the
// `.eq('user_id', ...)` call) would still be caught by RLS server-side, but
// this test catches it immediately, locally, without needing a live DB.
describe('deleteRequest', () => {
  it('scopes the delete to both the request id and the calling user, never the id alone', async () => {
    const deleteBuilder: Record<string, jest.Mock> = {};
    deleteBuilder.delete = jest.fn(() => deleteBuilder);
    deleteBuilder.eq = jest.fn(() => deleteBuilder);
    // The final .eq() in the real chain resolves the query -- mimic that by
    // making eq() itself thenable via a Promise.resolve() on the last call.
    let eqCallCount = 0;
    deleteBuilder.eq = jest.fn(() => {
      eqCallCount += 1;
      if (eqCallCount === 2) return Promise.resolve({ error: null });
      return deleteBuilder;
    });
    mockedSupabase.from.mockReturnValue(deleteBuilder as never);

    useRequestStore.setState({
      requests: [makePaymentRequestForStore('r1', 'pending')],
      isCreating: false,
      status: 'loaded',
      error: null,
    });

    await useRequestStore.getState().deleteRequest('user-1', 'r1');

    expect(mockedSupabase.from).toHaveBeenCalledWith('payment_requests');
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(1, 'id', 'r1');
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
    expect(useRequestStore.getState().requests).toHaveLength(0);
  });
});

// Archive Requests -- archived != deleted: status, payment history, and
// every identifier are untouched. archiveRequest/restoreRequest both go
// through a SECURITY DEFINER RPC (archive_payment_request/
// restore_payment_request, migration 0021) rather than a direct
// .from('payment_requests').update() -- migration 0017 revoked UPDATE on
// payment_requests from `authenticated`, so a direct update always failed
// with a Postgres permission error. The RPC enforces ownership itself
// (`user_id = auth.uid()`), same posture as cancel_payment_request.
describe('archiveRequest', () => {
  it('calls archive_payment_request and updates the local row without touching status', async () => {
    const archivedAtIso = '2026-09-10T00:00:00.000Z';
    mockedSupabase.rpc.mockResolvedValue({ data: archivedAtIso, error: null } as never);

    useRequestStore.setState({
      requests: [makePaymentRequestForStore('r1', 'paid')],
      isCreating: false,
      status: 'loaded',
      error: null,
    });

    await useRequestStore.getState().archiveRequest('user-1', 'r1');

    expect(mockedSupabase.rpc).toHaveBeenCalledWith('archive_payment_request', { p_request_id: 'r1' });

    const updated = useRequestStore.getState().requests[0];
    expect(updated.archivedAt).toBe(archivedAtIso);
    expect(updated.status).toBe('paid'); // status is never changed by archiving
  });

  it('an archived request is excluded from a normal (non-archived) view but included when explicitly filtering for archived', () => {
    const archived: PaymentRequest = { ...makePaymentRequestForStore('r1', 'paid'), archivedAt: '2026-09-10T00:00:00.000Z' };
    const active: PaymentRequest = makePaymentRequestForStore('r2', 'pending');
    const requests: PaymentRequest[] = [archived, active];

    expect(requests.filter((r) => !r.archivedAt)).toEqual([active]);
    expect(requests.filter((r) => !!r.archivedAt)).toEqual([archived]);
  });

  it('never touches transactions or request_events -- archived != deleted', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: '2026-09-10T00:00:00.000Z', error: null } as never);

    useRequestStore.setState({ requests: [makePaymentRequestForStore('r1', 'paid')], isCreating: false, status: 'loaded', error: null });
    useTransactionStore.setState({
      transactions: [{ id: 't1', requestId: 'r1', amount: 100, currency: 'USDC', network: 'Solana', fromCustomerId: 'c1', txHash: 'hash1', paidAt: '2026-09-01T00:00:00.000Z' }],
      status: 'loaded',
      error: null,
    });
    useRequestEventStore.setState({ events: [{ id: 'e1', requestId: 'r1', type: 'payment_confirmed', occurredAt: '2026-09-01T00:00:00.000Z' }], status: 'loaded', error: null });

    await useRequestStore.getState().archiveRequest('user-1', 'r1');

    expect(mockedSupabase.from).not.toHaveBeenCalledWith('transactions');
    expect(mockedSupabase.from).not.toHaveBeenCalledWith('request_events');
    expect(useTransactionStore.getState().transactions).toHaveLength(1);
    expect(useRequestEventStore.getState().events).toHaveLength(1);
  });

  it('throws a sanitized, friendly message (never the raw Postgres error) when the RPC errors', async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table payment_requests', code: '42501' },
    } as never);

    useRequestStore.setState({ requests: [makePaymentRequestForStore('r1', 'paid')], isCreating: false, status: 'loaded', error: null });

    await expect(useRequestStore.getState().archiveRequest('user-1', 'r1')).rejects.toThrow(
      "We couldn't save this request. Try again."
    );
  });

  it('throws a not-found message when the RPC matches zero rows (wrong id / not owned)', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null } as never);

    useRequestStore.setState({ requests: [makePaymentRequestForStore('r1', 'paid')], isCreating: false, status: 'loaded', error: null });

    await expect(useRequestStore.getState().archiveRequest('user-1', 'r1')).rejects.toThrow(
      "This request couldn't be found. It may have already been removed."
    );
  });
});

describe('restoreRequest', () => {
  it('calls restore_payment_request and updates the local row', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: true, error: null } as never);

    useRequestStore.setState({
      requests: [{ ...makePaymentRequestForStore('r1', 'paid'), archivedAt: '2026-09-10T00:00:00.000Z' }],
      isCreating: false,
      status: 'loaded',
      error: null,
    });

    await useRequestStore.getState().restoreRequest('user-1', 'r1');

    expect(mockedSupabase.rpc).toHaveBeenCalledWith('restore_payment_request', { p_request_id: 'r1' });
    expect(useRequestStore.getState().requests[0].archivedAt).toBeNull();
  });

  it('throws a not-found message when the RPC matches zero rows (wrong id / not owned)', async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: false, error: null } as never);

    useRequestStore.setState({
      requests: [{ ...makePaymentRequestForStore('r1', 'paid'), archivedAt: '2026-09-10T00:00:00.000Z' }],
      isCreating: false,
      status: 'loaded',
      error: null,
    });

    await expect(useRequestStore.getState().restoreRequest('user-1', 'r1')).rejects.toThrow(
      "This request couldn't be found. It may have already been removed."
    );
  });
});

// "archive survives logout/login" -- archived_at is a real persisted DB
// column, read back by loadForUser exactly like every other field, so a
// fresh load after reset() (the sign-out/sign-in lifecycle) must still
// reflect it.
describe('archived_at persists across reset/reload (logout/login)', () => {
  it('a reload after reset still reports the request as archived', async () => {
    const selectBuilder: Record<string, jest.Mock> = {};
    selectBuilder.select = jest.fn(() => selectBuilder);
    selectBuilder.eq = jest.fn(() => selectBuilder);
    selectBuilder.order = jest.fn(() =>
      Promise.resolve({ data: [mapRequestRow({ id: 'r1', archived_at: '2026-09-10T00:00:00.000Z' })], error: null })
    );
    mockedSupabase.from.mockReturnValue(selectBuilder as never);

    await useRequestStore.getState().loadForUser('user-1');
    expect(useRequestStore.getState().requests[0].archivedAt).toBe('2026-09-10T00:00:00.000Z');

    useRequestStore.getState().reset();
    expect(useRequestStore.getState().requests).toHaveLength(0);

    await useRequestStore.getState().loadForUser('user-1');
    expect(useRequestStore.getState().requests[0].archivedAt).toBe('2026-09-10T00:00:00.000Z');
  });

  it('an ordinary (never-archived) request loads with archivedAt null, not undefined/missing', async () => {
    const selectBuilder: Record<string, jest.Mock> = {};
    selectBuilder.select = jest.fn(() => selectBuilder);
    selectBuilder.eq = jest.fn(() => selectBuilder);
    selectBuilder.order = jest.fn(() => Promise.resolve({ data: [mapRequestRow({ id: 'r1' })], error: null }));
    mockedSupabase.from.mockReturnValue(selectBuilder as never);

    await useRequestStore.getState().loadForUser('user-1');

    expect(useRequestStore.getState().requests[0].archivedAt).toBeNull();
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
