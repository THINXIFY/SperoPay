import type { PaymentRequest } from '../types';

export interface CustomerStats {
  totalRequests: number;
  totalReceived: number;
  outstanding: number;
}

export function getCustomerStats(customerId: string, requests: PaymentRequest[]): CustomerStats {
  const customerRequests = requests.filter((r) => r.customerId === customerId);

  const totalReceived = customerRequests
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + r.amount, 0);

  const outstanding = customerRequests
    .filter((r) => r.status === 'pending' || r.status === 'confirming')
    .reduce((sum, r) => sum + r.amount, 0);

  return {
    totalRequests: customerRequests.length,
    totalReceived,
    outstanding,
  };
}
