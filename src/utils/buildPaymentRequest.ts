import type { PaymentRequest, ExpiryOption } from '../types';
import { generateId, generatePaymentCode } from './ids';
import { calculateExpiresAt } from './expiry';

export interface CreateRequestInput {
  amount: number;
  description?: string;
  customerId?: string;
  expiryOption: ExpiryOption;
  note?: string;
}

export function buildPaymentRequest(input: CreateRequestInput, now: Date = new Date()): PaymentRequest {
  const id = generateId();

  return {
    id,
    paymentCode: generatePaymentCode(),
    amount: input.amount,
    currency: 'USDC',
    network: 'Solana',
    description: input.description,
    customerId: input.customerId,
    expiryOption: input.expiryOption,
    expiresAt: calculateExpiresAt(input.expiryOption, now),
    note: input.note,
    status: 'pending',
    createdAt: now.toISOString(),
    paymentLink: `https://pay.thinxpay.app/r/${id}`,
  };
}
