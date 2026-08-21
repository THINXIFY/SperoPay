import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { createStaleGuard } from './staleGuard';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Transaction } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface TransactionState {
  transactions: Transaction[];
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  getTransactionForRequest: (requestId: string) => Transaction | undefined;
  addLocal: (transaction: Transaction) => void;
  reset: () => void;
}

const guard = createStaleGuard();

function mapRow(row: {
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

export const useTransactionStore = create<TransactionState>()((set, get) => ({
  transactions: [],
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    const token = guard.next();
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      if (!guard.isCurrent(token)) return;
      set({ transactions: (data ?? []).map(mapRow), status: 'loaded' });
    } catch (error) {
      if (!guard.isCurrent(token)) return;
      set({ status: 'error', error: getDataErrorMessage(error, 'requests') });
    }
  },

  getTransactionForRequest: (requestId) => get().transactions.find((t) => t.requestId === requestId),

  // Written server-side only (inside complete_payment) — this merges the
  // RPC's returned row into the local cache, it never inserts directly.
  addLocal: (transaction) => {
    guard.next(); // invalidate any in-flight load — this write must survive it
    set((state) => ({ transactions: [transaction, ...state.transactions] }));
  },

  reset: () => {
    guard.next();
    set({ transactions: [], status: 'idle', error: null });
  },
}));

registerResettable(() => useTransactionStore.getState().reset());
