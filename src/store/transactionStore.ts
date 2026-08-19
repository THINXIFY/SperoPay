import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction } from '../types';
import { mockTransactions } from '../data/transactions';

interface TransactionState {
  transactions: Transaction[];
  getTransactionForRequest: (requestId: string) => Transaction | undefined;
  addTransaction: (transaction: Transaction) => Transaction;
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: mockTransactions,
      getTransactionForRequest: (requestId) => get().transactions.find((t) => t.requestId === requestId),
      addTransaction: (transaction) => {
        set((state) => ({ transactions: [transaction, ...state.transactions] }));
        return transaction;
      },
    }),
    { name: 'speropay/transactions', storage: createJSONStorage(() => AsyncStorage) }
  )
);
