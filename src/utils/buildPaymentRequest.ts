import type { ExpiryOption } from '../types';
import { generatePaymentCode } from './ids';
import { calculateExpiresAt } from './expiry';
import { generateSolanaReference } from '../services/blockchain/solana/reference';

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
// solanaReference is generated the same way, for the same reason: the
// merchant never does anything, and the value must exist by the time the
// row is inserted (spec section 4).
export interface PaymentRequestPayload {
  paymentCode: string;
  paymentLink: string;
  solanaReference: string;
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
    solanaReference: generateSolanaReference(),
    amount: input.amount,
    description: input.description,
    customerId: input.customerId,
    expiryOption: input.expiryOption,
    expiresAt: calculateExpiresAt(input.expiryOption, now),
    note: input.note,
  };
}
