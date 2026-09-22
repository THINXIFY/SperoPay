import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { createStaleGuard } from './staleGuard';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { PaymentRequest } from '../types';
import { buildPaymentRequestPayload, type CreateRequestInput } from '../utils/buildPaymentRequest';
import { requestDebugLog } from '../utils/requestDebugLog';
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
  archiveRequest: (userId: string, id: string) => Promise<void>;
  restoreRequest: (userId: string, id: string) => Promise<void>;
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
  solana_reference?: string | null;
  created_at: string;
  due_at?: string | null;
  allow_partial_payments?: boolean | null;
  deposit_type?: 'fixed' | 'percentage' | null;
  deposit_value?: string | number | null;
  recurring_plan_id?: string | null;
  recurring_occurrence_number?: number | null;
  archived_at?: string | null;
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
    dueAt: row.due_at ?? null,
    note: row.note ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    paymentLink: row.payment_link,
    publicToken: row.public_token,
    solanaReference: row.solana_reference ?? null,
    allowPartialPayments: row.allow_partial_payments ?? false,
    depositType: row.deposit_type ?? undefined,
    depositValue: row.deposit_value != null ? Number(row.deposit_value) : undefined,
    recurringPlanId: row.recurring_plan_id ?? undefined,
    recurringOccurrenceNumber: row.recurring_occurrence_number ?? undefined,
    archivedAt: row.archived_at ?? null,
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
    const MAX_ATTEMPTS = 3;
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // Rebuilt fresh on every attempt -- a genuinely new payment_code AND
        // solana_reference each time, not a re-send of the same values, so a
        // retry after a collision has a real chance to succeed instead of
        // colliding again. payment_code is 5 characters from a 32-character
        // alphabet (~33.5M combinations) generated client-side -- an
        // astronomically unlikely collision on any single request, but a
        // merchant must be able to create truly unlimited requests over the
        // account's lifetime, so this can never be allowed to become a
        // permanent wall for the one merchant unlucky enough to hit it.
        const payload = buildPaymentRequestPayload(input);
        const rpcParams = {
          p_customer_id: payload.customerId ?? null,
          p_wallet_id: null,
          p_payment_code: payload.paymentCode,
          p_amount: payload.amount,
          p_description: payload.description ?? null,
          p_note: payload.note ?? null,
          p_expiry_option: payload.expiryOption,
          p_expires_at: payload.expiresAt,
          p_payment_link: payload.paymentLink,
          p_solana_reference: payload.solanaReference,
          p_due_at: payload.dueAt ?? null,
          p_allow_partial_payments: payload.allowPartialPayments ?? false,
          p_deposit_type: payload.depositType ?? null,
          p_deposit_value: payload.depositValue ?? null,
          p_currency: payload.currency,
        };
        // Temporary diagnostic checkpoint -- see requestDebugLog.ts. Logs
        // only non-secret identifiers: no auth token, no session data.
        requestDebugLog('createRequest: calling create_payment_request', {
          attempt,
          userId,
          p_customer_id: rpcParams.p_customer_id,
          p_payment_code: rpcParams.p_payment_code,
          p_solana_reference: rpcParams.p_solana_reference,
          p_amount: rpcParams.p_amount,
        });

        const { data, error, status, statusText } = await supabase.rpc('create_payment_request', rpcParams);

        if (!error) {
          const request = mapRequestRow(data);
          requestDebugLog('createRequest: succeeded', {
            attempt,
            status,
            requestId: request.id,
            paymentCode: request.paymentCode,
            publicToken: request.publicToken,
            solanaReference: request.solanaReference,
          });
          set((state) => ({ requests: [request, ...state.requests], isCreating: false }));
          useRequestEventStore
            .getState()
            .addLocal({ id: `${request.id}-created`, requestId: request.id, type: 'created', occurredAt: request.createdAt });
          return request;
        }

        // Temporary diagnostic checkpoint -- the exact Postgres/PostgREST
        // error, so a live-device failure can be diagnosed from the actual
        // response instead of the generic Alert the user sees. `code` is the
        // Postgres SQLSTATE (e.g. '23505' unique_violation, '42501'
        // insufficient_privilege/RLS denial, '42883' no matching function
        // signature); `details`/`hint` are whatever Postgres itself attached.
        requestDebugLog('createRequest: RPC returned an error', {
          attempt,
          status,
          statusText,
          code: (error as { code?: string }).code,
          message: error.message,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
        });

        // '23505' is Postgres's unique_violation SQLSTATE -- the only case
        // worth retrying (a fresh payload might not collide again). Any
        // other error (validation, RLS, network) fails immediately and
        // unchanged, exactly as before this hardening was added.
        const isUniqueViolation = (error as { code?: string }).code === '23505';
        if (!isUniqueViolation || attempt === MAX_ATTEMPTS) {
          throw error;
        }
      }
      // Unreachable (the loop always returns or throws), but keeps this an
      // exhaustive async function for TypeScript.
      throw new Error('createRequest: exhausted retry attempts without a definitive result');
    } catch (error) {
      requestDebugLog('createRequest: failed (final)', {
        message: error instanceof Error ? error.message : String(error),
        code: (error as { code?: string })?.code,
      });
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

  // Archived != deleted: status, payment history, invoice/receipt data,
  // and every identifier (paymentCode/publicToken/solanaReference) are
  // completely untouched -- only archived_at changes. Goes through an RPC
  // (not a direct .update()) because migration 0017 revoked UPDATE on
  // payment_requests from `authenticated` -- a direct table write here
  // would always fail with a Postgres permission error, exactly the bug
  // this RPC fixes. Ownership is enforced inside the function body
  // (`user_id = auth.uid()`), same posture as cancel_payment_request.
  archiveRequest: async (userId, id) => {
    const { data, error } = await supabase.rpc('archive_payment_request', { p_request_id: id });
    if (error) {
      const message = getDataErrorMessage(error, 'requests', 'save');
      set({ error: message });
      throw new Error(message);
    }
    if (!data) {
      const message = "This request couldn't be found. It may have already been removed.";
      set({ error: message });
      throw new Error(message);
    }
    set((state) => ({
      requests: state.requests.map((r) => (r.id === id ? { ...r, archivedAt: data as string } : r)),
    }));
  },

  restoreRequest: async (userId, id) => {
    const { data: succeeded, error } = await supabase.rpc('restore_payment_request', { p_request_id: id });
    if (error) {
      const message = getDataErrorMessage(error, 'requests', 'save');
      set({ error: message });
      throw new Error(message);
    }
    if (!succeeded) {
      const message = "This request couldn't be found. It may have already been removed.";
      set({ error: message });
      throw new Error(message);
    }
    set((state) => ({
      requests: state.requests.map((r) => (r.id === id ? { ...r, archivedAt: null } : r)),
    }));
  },

  reset: () => {
    guard.next();
    set({ requests: [], isCreating: false, status: 'idle', error: null });
  },
}));

registerResettable(() => useRequestStore.getState().reset());
