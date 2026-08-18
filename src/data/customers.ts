import type { Customer } from '../types';

export const mockCustomers: Customer[] = [
  {
    id: 'cust-john-doe',
    name: 'John Doe',
    email: 'john@doe.com',
    avatarColor: 'blue',
    totalRequests: 3,
    totalAmount: 2250,
  },
  {
    id: 'cust-acme-studios',
    name: 'Acme Studios',
    email: 'billing@acmestudios.com',
    avatarColor: 'mint',
    totalRequests: 5,
    totalAmount: 4560,
  },
  {
    id: 'cust-web3-labs',
    name: 'Web3 Labs',
    email: 'hello@web3labs.io',
    avatarColor: 'lavender',
    totalRequests: 2,
    totalAmount: 1200,
  },
  {
    id: 'cust-design-collective',
    name: 'Design Collective',
    email: 'pay@designcollective.co',
    avatarColor: 'red',
    totalRequests: 4,
    totalAmount: 980,
  },
  {
    id: 'cust-mike-harrison',
    name: 'Mike Harrison',
    email: 'mike@harrison.co',
    avatarColor: 'blue',
    totalRequests: 1,
    totalAmount: 750,
  },
];
