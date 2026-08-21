import type { ExpiryOption } from '../types';
import { generatePaymentCode } from './ids';
import { calculateExpiresAt } from './expiry';

export interface CreateRequestInput {
  amount: number;
  description?: string;
  customerId?: string;
  expiryOption: ExpiryOption;
  note?: string;
}

// The insert payload for create_payment_request — everything the RPC needs
// that can be computed client-side before the row (and its Postgres-
// generated id) exists. paymentLink is derived from paymentCode (known
// up-front), not the row id (only known after insert) — see design doc 3.6.
export interface PaymentRequestPayload {
  paymentCode: string;
  paymentLink: string;
  amount: number;
  description?: string;
  customerId?: string;
  expiryOption: ExpiryOption;
  expiresAt: string | null;
  note?: string;
}

export function buildPaymentRequestPayload(input: CreateRequestInput, now: Date = new Date()): PaymentRequestPayload {
  const paymentCode = generatePaymentCode();

  return {
    paymentCode,
    paymentLink: `https://pay.speropay.app/r/${paymentCode}`,
    amount: input.amount,
    description: input.description,
    customerId: input.customerId,
    expiryOption: input.expiryOption,
    expiresAt: calculateExpiresAt(input.expiryOption, now),
    note: input.note,
  };
}
