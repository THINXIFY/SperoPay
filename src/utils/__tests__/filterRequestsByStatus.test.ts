import { filterRequestsByStatus } from '../filterRequestsByStatus';
import type { PaymentRequest } from '../../types';

function makeRequest(overrides: Partial<PaymentRequest> & { id: string }): PaymentRequest {
  return {
    paymentCode: `SP-${overrides.id}`,
    amount: 100,
    currency: 'USDC',
    network: 'Solana',
    expiryOption: '7d',
    expiresAt: null,
    status: 'pending',
    createdAt: '2026-09-01T00:00:00.000Z',
    paymentLink: '',
    publicToken: `token-${overrides.id}`,
    solanaReference: null,
    ...overrides,
  };
}

describe('filterRequestsByStatus', () => {
  const pending = makeRequest({ id: 'r1', status: 'pending' });
  const paid = makeRequest({ id: 'r2', status: 'paid' });
  const archivedPending = makeRequest({ id: 'r3', status: 'pending', archivedAt: '2026-09-05T00:00:00.000Z' });
  const archivedPaid = makeRequest({ id: 'r4', status: 'paid', archivedAt: '2026-09-06T00:00:00.000Z' });
  const all = [pending, paid, archivedPending, archivedPaid];

  it('"all" excludes archived requests -- they disappear from the normal list by default', () => {
    expect(filterRequestsByStatus(all, 'all')).toEqual([pending, paid]);
  });

  it('"archived" shows ONLY archived requests, regardless of their status', () => {
    expect(filterRequestsByStatus(all, 'archived')).toEqual([archivedPending, archivedPaid]);
  });

  it('a literal status filter also excludes archived requests with that same status', () => {
    expect(filterRequestsByStatus(all, 'pending')).toEqual([pending]);
    expect(filterRequestsByStatus(all, 'paid')).toEqual([paid]);
  });

  it('archiving does not change status -- an archived paid request never leaks into the "paid" filter', () => {
    expect(filterRequestsByStatus(all, 'paid')).not.toContain(archivedPaid);
  });

  it('returns an empty array when nothing is archived and the "archived" filter is selected', () => {
    expect(filterRequestsByStatus([pending, paid], 'archived')).toEqual([]);
  });
});
