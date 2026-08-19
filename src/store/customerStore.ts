import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Customer } from '../types';
import { mockCustomers } from '../data/customers';
import { generateId } from '../utils/ids';

interface CustomerState {
  customers: Customer[];
  addCustomer: (name: string, email: string) => Customer;
  getCustomerById: (id: string) => Customer | undefined;
}

const AVATAR_COLORS: Customer['avatarColor'][] = ['mint', 'lavender', 'blue', 'red'];

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set, get) => ({
      customers: mockCustomers,
      addCustomer: (name, email) => {
        const customer: Customer = {
          id: generateId(),
          name,
          email,
          avatarColor: AVATAR_COLORS[get().customers.length % AVATAR_COLORS.length],
          totalRequests: 0,
          totalAmount: 0,
        };
        set((state) => ({ customers: [customer, ...state.customers] }));
        return customer;
      },
      getCustomerById: (id) => get().customers.find((c) => c.id === id),
    }),
    { name: 'speropay/customers', storage: createJSONStorage(() => AsyncStorage) }
  )
);
