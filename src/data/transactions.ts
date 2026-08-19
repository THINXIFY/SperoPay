import type { Transaction } from '../types';

export const mockTransactions: Transaction[] = [
  {
    id: 'txn-req-1',
    requestId: 'req-1',
    amount: 1250,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-acme-studios',
    txHash: '5LwYkP2vX9mT4qR8jH3nD7fC1sB6uA0oE5wZyN9KxP',
    paidAt: '2026-08-18T10:16:00.000Z',
  },
  {
    id: 'txn-req-5',
    requestId: 'req-5',
    amount: 2000,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-john-doe',
    txHash: '3MvBnQ7xT2kP9jR4hD8fC1sA6uE0oZ5wY9nX3mKxQL',
    paidAt: '2026-08-17T09:01:00.000Z',
  },
  {
    id: 'txn-req-6',
    requestId: 'req-6',
    amount: 150,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-john-doe',
    txHash: '8KpXwN4vQ2mT7jR9hD3fC6sB1uA5oE0zY8nP4mKxRT',
    paidAt: '2026-08-17T07:41:00.000Z',
  },
];
