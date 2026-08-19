import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Customer } from '../types';
import { mockCustomers } from '../data/customers';
import { generateId } from '../utils/ids';

export interface AddCustomerInput {
  name: string;
  email: string;
  company?: string;
  notes?: string;
}

interface CustomerState {
  customers: Customer[];
  addCustomer: (input: AddCustomerInput) => Customer;
  updateCustomer: (id: string, patch: Partial<Omit<Customer, 'id'>>) => void;
  getCustomerById: (id: string) => Customer | undefined;
}

const AVATAR_COLORS: Customer['avatarColor'][] = ['mint', 'lavender', 'blue', 'red'];

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set, get) => ({
      customers: mockCustomers,
      addCustomer: (input) => {
        const customer: Customer = {
          id: generateId(),
          name: input.name,
          email: input.email,
          company: input.company,
          notes: input.notes,
          avatarColor: AVATAR_COLORS[get().customers.length % AVATAR_COLORS.length],
        };
        set((state) => ({ customers: [customer, ...state.customers] }));
        return customer;
      },
      updateCustomer: (id, patch) =>
        set((state) => ({
          customers: state.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      getCustomerById: (id) => get().customers.find((c) => c.id === id),
    }),
    { name: 'speropay/customers', storage: createJSONStorage(() => AsyncStorage) }
  )
);
