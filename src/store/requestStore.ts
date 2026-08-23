import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { createStaleGuard } from './staleGuard';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { PaymentRequest, Transaction } from '../types';
import { buildPaymentRequestPayload, type CreateRequestInput } from '../utils/buildPaymentRequest';
import { canBeginPaymentConfirmation, canCompletePayment, DEMO_PAYMENT_FAILURE_RATE } from '../utils/paymentSimulation';
import { generateTxHash } from '../utils/ids';
import { useRequestEventStore } from './requestEventStore';
import { useTransactionStore } from './transactionStore';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface RequestState {
  requests: PaymentRequest[];
  isCreating: boolean;
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  createRequest: (userId: string, input: CreateRequestInput) => Promise<PaymentRequest>;
  getRequestById: (id: string) => PaymentRequest | undefined;
  cancelRequest: (userId: string, id: string) => Promise<void>;
  deleteRequest: (userId: string, id: string) => Promise<void>;
  beginPaymentConfirmation: (userId: string, id: string) => Promise<boolean>;
  completePayment: (userId: string, id: string, options?: { forceFailure?: boolean }) => Promise<Transaction | null>;
  reset: () => void;
}

const guard = createStaleGuard();

function mapRequestRow(row: {
  id: string;
  customer_id: string | null;
  payment_code: string;
  amount: string | number;
  currency: PaymentRequest['currency'];
  network: PaymentRequest['network'];
  description: string | null;
  note: string | null;
  expiry_option: PaymentRequest['expiryOption'];
  expires_at: string | null;
  status: PaymentRequest['status'];
  payment_link: string;
  public_token: string;
  created_at: string;
}): PaymentRequest {
  return {
    id: row.id,
    paymentCode: row.payment_code,
    amount: Number(row.amount),
    currency: row.currency,
    network: row.network,
    description: row.description ?? undefined,
    customerId: row.customer_id ?? undefined,
    expiryOption: row.expiry_option,
    expiresAt: row.expires_at,
    note: row.note ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    paymentLink: row.payment_link,
    publicToken: row.public_token,
  };
}

function mapTransactionRow(row: {
  id: string;
  payment_request_id: string;
  from_customer_id: string | null;
  amount: string | number;
  currency: Transaction['currency'];
  network: Transaction['network'];
  tx_hash: string;
  paid_at: string;
}): Transaction {
  return {
    id: row.id,
    requestId: row.payment_request_id,
    amount: Number(row.amount),
    currency: row.currency,
    network: row.network,
    fromCustomerId: row.from_customer_id ?? '',
    txHash: row.tx_hash,
    paidAt: row.paid_at,
  };
}

export const useRequestStore = create<RequestState>()((set, get) => ({
  requests: [],
  isCreating: false,
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    const token = guard.next();
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!guard.isCurrent(token)) return;
      set({ requests: (data ?? []).map(mapRequestRow), status: 'loaded' });
    } catch (error) {
      if (!guard.isCurrent(token)) return;
      set({ status: 'error', error: getDataErrorMessage(error, 'requests') });
    }
  },

  createRequest: async (userId, input) => {
    guard.next(); // invalidate any in-flight load — this optimistic write must survive it
    set({ isCreating: true });
    try {
      const payload = buildPaymentRequestPayload(input);
      const { data, error } = await supabase.rpc('create_payment_request', {
        p_customer_id: payload.customerId ?? null,
        p_wallet_id: null,
        p_payment_code: payload.paymentCode,
        p_amount: payload.amount,
        p_description: payload.description ?? null,
        p_note: payload.note ?? null,
        p_expiry_option: payload.expiryOption,
        p_expires_at: payload.expiresAt,
        p_payment_link: payload.paymentLink,
      });
      if (error) throw error;
      const request = mapRequestRow(data);
      set((state) => ({ requests: [request, ...state.requests], isCreating: false }));
      useRequestEventStore
        .getState()
        .addLocal({ id: `${request.id}-created`, requestId: request.id, type: 'created', occurredAt: request.createdAt });
      return request;
    } catch (error) {
      set({ isCreating: false, error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
  },

  getRequestById: (id) => get().requests.find((r) => r.id === id),

  cancelRequest: async (userId, id) => {
    const request = get().requests.find((r) => r.id === id);
    if (!request || request.status === 'paid' || request.status === 'expired' || request.status === 'cancelled') {
      return;
    }
    guard.next();
    const { data: succeeded, error } = await supabase.rpc('cancel_payment_request', { p_request_id: id });
    if (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
    if (!succeeded) return;
    set((state) => ({ requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)) }));
    useRequestEventStore
      .getState()
      .addLocal({ id: `${id}-cancelled-${Date.now()}`, requestId: id, type: 'cancelled', occurredAt: new Date().toISOString() });
  },

  deleteRequest: async (userId, id) => {
    guard.next();
    // Plain RLS-guarded delete — ON DELETE CASCADE on request_events and
    // transactions removes both atomically, no RPC needed (design doc 3.3).
    const { error } = await supabase.from('payment_requests').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
    set((state) => ({ requests: state.requests.filter((r) => r.id !== id) }));
    useRequestEventStore.setState((state) => ({ events: state.events.filter((e) => e.requestId !== id) }));
    useTransactionStore.setState((state) => ({ transactions: state.transactions.filter((t) => t.requestId !== id) }));
  },

  beginPaymentConfirmation: async (userId, id) => {
    const request = get().requests.find((r) => r.id === id);
    if (!canBeginPaymentConfirmation(request)) return false;

    guard.next();
    const { data: succeeded, error } = await supabase.rpc('begin_payment_confirmation', { p_request_id: id });
    if (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }
    if (!succeeded) return false;

    set((state) => ({ requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'confirming' } : r)) }));
    useRequestEventStore
      .getState()
      .addLocal({ id: `${id}-detected-${Date.now()}`, requestId: id, type: 'payment_detected', occurredAt: new Date().toISOString() });
    return true;
  },

  completePayment: async (userId, id, options) => {
    const request = get().requests.find((r) => r.id === id);
    if (!canCompletePayment(request)) return null;

    guard.next();
    const shouldFail = options?.forceFailure ?? Math.random() < DEMO_PAYMENT_FAILURE_RATE;
    const { data, error } = await supabase.rpc('complete_payment', {
      p_request_id: id,
      p_should_fail: shouldFail,
      p_tx_hash: generateTxHash(),
    });
    if (error) {
      set({ error: getDataErrorMessage(error, 'requests', 'save') });
      throw error;
    }

    // complete_payment is a `returns setof` function, so data is an array —
    // empty on both the not-found and simulated-failure branches. Checking
    // the array (not a bare `!data`) matters: a `returns` (non-setof)
    // composite function that `return null`s would otherwise come back from
    // PostgREST as one row of all-null columns, which is truthy.
    const transactionRow = Array.isArray(data) ? data[0] : data;
    if (!transactionRow || !transactionRow.id) {
      set((state) => ({ requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'pending' } : r)) }));
      useRequestEventStore
        .getState()
        .addLocal({ id: `${id}-failed-${Date.now()}`, requestId: id, type: 'payment_failed', occurredAt: new Date().toISOString() });
      return null;
    }

    const transaction = mapTransactionRow(transactionRow);
    useTransactionStore.getState().addLocal(transaction);
    set((state) => ({ requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'paid' } : r)) }));
    useRequestEventStore
      .getState()
      .addLocal({ id: `${id}-confirmed-${Date.now()}`, requestId: id, type: 'payment_confirmed', occurredAt: new Date().toISOString() });
    return transaction;
  },

  reset: () => {
    guard.next();
    set({ requests: [], isCreating: false, status: 'idle', error: null });
  },
}));

registerResettable(() => useRequestStore.getState().reset());
