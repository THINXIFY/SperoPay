import type { Customer } from '../types';

export const mockCustomers: Customer[] = [
  {
    id: 'cust-john-doe',
    name: 'John Doe',
    email: 'john@doe.com',
    avatarColor: 'blue',
    totalRequests: 2,
    totalAmount: 2150,
  },
  {
    id: 'cust-acme-studios',
    name: 'Acme Studios',
    email: 'billing@acmestudios.com',
    avatarColor: 'mint',
    totalRequests: 1,
    totalAmount: 1250,
  },
  {
    id: 'cust-web3-labs',
    name: 'Web3 Labs',
    email: 'hello@web3labs.io',
    avatarColor: 'lavender',
    totalRequests: 1,
    totalAmount: 750,
  },
  {
    id: 'cust-design-collective',
    name: 'Design Collective',
    email: 'pay@designcollective.co',
    avatarColor: 'red',
    totalRequests: 1,
    totalAmount: 320,
  },
  {
    id: 'cust-mike-harrison',
    name: 'Mike Harrison',
    email: 'mike@harrison.co',
    avatarColor: 'blue',
    totalRequests: 1,
    totalAmount: 500,
  },
];
