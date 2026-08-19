import type { Customer } from '../types';

export const mockCustomers: Customer[] = [
  {
    id: 'cust-john-doe',
    name: 'John Doe',
    email: 'john@doe.com',
    avatarColor: 'blue',
    company: 'Doe Consulting',
  },
  {
    id: 'cust-acme-studios',
    name: 'Acme Studios',
    email: 'billing@acmestudios.com',
    avatarColor: 'mint',
    company: 'Acme Studios',
  },
  {
    id: 'cust-web3-labs',
    name: 'Web3 Labs',
    email: 'hello@web3labs.io',
    avatarColor: 'lavender',
    company: 'Web3 Labs',
  },
  {
    id: 'cust-design-collective',
    name: 'Design Collective',
    email: 'pay@designcollective.co',
    avatarColor: 'red',
    company: 'Design Collective',
  },
  {
    id: 'cust-mike-harrison',
    name: 'Mike Harrison',
    email: 'mike@harrison.co',
    avatarColor: 'blue',
  },
];
