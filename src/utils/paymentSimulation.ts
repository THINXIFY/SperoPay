import type { PaymentRequest, Transaction } from '../types';
import { generateId, generateTxHash } from './ids';

export const DEMO_PAYMENT_FAILURE_RATE = 0.12;

export function canBeginPaymentConfirmation(request: PaymentRequest | undefined): boolean {
  return request?.status === 'pending';
}

export function canCompletePayment(request: PaymentRequest | undefined): boolean {
  return request?.status === 'confirming';
}

export function buildTransaction(request: PaymentRequest, now: Date = new Date()): Transaction {
  return {
    id: generateId(),
    requestId: request.id,
    amount: request.amount,
    currency: request.currency,
    network: request.network,
    fromCustomerId: request.customerId ?? '',
    txHash: generateTxHash(),
    paidAt: now.toISOString(),
  };
}
