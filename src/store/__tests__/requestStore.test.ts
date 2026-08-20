// The stores under test use zustand's `persist` middleware backed by AsyncStorage, whose
// native module is unavailable under Jest. This is the mock the AsyncStorage package ships
// for exactly this purpose; it keeps persistence inert so the store logic can be tested.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useRequestStore } from '../requestStore';
import { useTransactionStore } from '../transactionStore';
import { useRequestEventStore } from '../requestEventStore';
import type { PaymentRequest } from '../../types';

function makeRequest(overrides: Partial<PaymentRequest>): PaymentRequest {
  return {
    id: 'req-test',
    paymentCode: 'SP-TEST1',
    amount: 750,
    currency: 'USDC',
    network: 'Solana',
    customerId: 'cust-1',
    expiryOption: '7d',
    expiresAt: null,
    status: 'pending',
    createdAt: '2026-08-18T00:00:00.000Z',
    paymentLink: 'https://pay.speropay.app/r/req-test',
    ...overrides,
  };
}

function resetStores(request: PaymentRequest) {
  useRequestStore.setState({ requests: [request], isCreating: false });
  useTransactionStore.setState({ transactions: [] });
  useRequestEventStore.setState({ events: [] });
}

describe('requestStore payment lifecycle', () => {
  it('transitions pending -> confirming -> paid, creates exactly one transaction, and logs both events once', () => {
    const request = makeRequest({ id: 'req-1', status: 'pending' });
    resetStores(request);

    const began = useRequestStore.getState().beginPaymentConfirmation('req-1');
    expect(began).toBe(true);
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-1')?.status).toBe('confirming');
    expect(useRequestEventStore.getState().events.filter((e) => e.type === 'payment_detected')).toHaveLength(1);

    const transaction = useRequestStore.getState().completePayment('req-1', { forceFailure: false });
    expect(transaction).not.toBeNull();
    expect(transaction!.requestId).toBe('req-1');
    expect(transaction!.amount).toBe(750);
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-1')?.status).toBe('paid');
    expect(useTransactionStore.getState().transactions).toHaveLength(1);
    expect(useRequestEventStore.getState().events.filter((e) => e.type === 'payment_confirmed')).toHaveLength(1);
  });

  it('a paid request cannot pay twice', () => {
    const request = makeRequest({ id: 'req-2', status: 'paid' });
    resetStores(request);

    expect(useRequestStore.getState().beginPaymentConfirmation('req-2')).toBe(false);
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-2')?.status).toBe('paid');
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it('an expired request cannot pay', () => {
    const request = makeRequest({ id: 'req-3', status: 'expired' });
    resetStores(request);

    expect(useRequestStore.getState().beginPaymentConfirmation('req-3')).toBe(false);
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-3')?.status).toBe('expired');
  });

  it('a cancelled request cannot pay', () => {
    const request = makeRequest({ id: 'req-4', status: 'cancelled' });
    resetStores(request);

    expect(useRequestStore.getState().beginPaymentConfirmation('req-4')).toBe(false);
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-4')?.status).toBe('cancelled');
  });

  it('completePayment on a request that is not confirming does nothing and creates no transaction', () => {
    const request = makeRequest({ id: 'req-5', status: 'pending' });
    resetStores(request);

    const result = useRequestStore.getState().completePayment('req-5');
    expect(result).toBeNull();
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-5')?.status).toBe('pending');
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it('a forced failure reverts confirming back to pending without creating a transaction or logging payment_confirmed', () => {
    const request = makeRequest({ id: 'req-6', status: 'confirming' });
    resetStores(request);

    const result = useRequestStore.getState().completePayment('req-6', { forceFailure: true });

    expect(result).toBeNull();
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-6')?.status).toBe('pending');
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
    expect(useRequestEventStore.getState().events.filter((e) => e.type === 'payment_confirmed')).toHaveLength(0);
  });

  it('deleteRequest removes the request and cascades to its events and its transaction', () => {
    const request = makeRequest({ id: 'req-7', status: 'pending' });
    resetStores(request);

    useRequestStore.getState().beginPaymentConfirmation('req-7');
    useRequestStore.getState().completePayment('req-7', { forceFailure: false });
    expect(useTransactionStore.getState().transactions).toHaveLength(1);
    expect(useRequestEventStore.getState().events.length).toBeGreaterThan(0);

    useRequestStore.getState().deleteRequest('req-7');

    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-7')).toBeUndefined();
    expect(useRequestEventStore.getState().events.filter((e) => e.requestId === 'req-7')).toHaveLength(0);
    expect(useTransactionStore.getState().transactions.filter((t) => t.requestId === 'req-7')).toHaveLength(0);
  });

  it('deleteRequest leaves other requests transactions and events untouched', () => {
    const request = makeRequest({ id: 'req-8', status: 'pending' });
    resetStores(request);

    useRequestStore.getState().beginPaymentConfirmation('req-8');
    useRequestStore.getState().completePayment('req-8', { forceFailure: false });

    useRequestStore.getState().deleteRequest('req-does-not-exist');

    expect(useTransactionStore.getState().transactions.filter((t) => t.requestId === 'req-8')).toHaveLength(1);
    expect(useRequestEventStore.getState().events.filter((e) => e.requestId === 'req-8').length).toBeGreaterThan(0);
  });
});
