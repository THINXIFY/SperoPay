import type { ExpiryOption } from '../types';
import { generatePaymentCode } from './ids';
import { calculateExpiresAt } from './expiry';
import { generateSolanaReference } from '../services/blockchain/solana/reference';
import { getCheckoutBaseUrl } from './checkoutBaseUrl';
import { DEFAULT_ASSET, type AssetSymbol } from '../config/assets';

export interface CreateRequestInput {
  amount: number;
  // Defaults to DEFAULT_ASSET (USDC) when omitted -- every pre-Phase-7
  // caller keeps behaving identically.
  currency?: AssetSymbol;
  description?: string;
  customerId?: string;
  expiryOption: ExpiryOption;
  note?: string;
  // ISO string -- when the merchant expects to be paid by. Separate from
  // expiryOption/expiresAt (the checkout link's own accept-payment window).
  // Reminders can't be scheduled without this being set.
  dueAt?: string;
  // Phase 4C: when false/undefined (the default), a request behaves exactly
  // as it always has. depositType/depositValue are only meaningful when
  // allowPartialPayments is true.
  allowPartialPayments?: boolean;
  depositType?: 'fixed' | 'percentage';
  depositValue?: number;
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
  currency: AssetSymbol;
  description?: string;
  customerId?: string;
  expiryOption: ExpiryOption;
  expiresAt: string | null;
  note?: string;
  dueAt?: string;
  allowPartialPayments?: boolean;
  depositType?: 'fixed' | 'percentage';
  depositValue?: number;
}

export function buildPaymentRequestPayload(input: CreateRequestInput, now: Date = new Date()): PaymentRequestPayload {
  const paymentCode = generatePaymentCode();

  return {
    paymentCode,
    paymentLink: `${getCheckoutBaseUrl()}/r/${paymentCode}`,
    solanaReference: generateSolanaReference(),
    amount: input.amount,
    currency: input.currency ?? DEFAULT_ASSET,
    description: input.description,
    customerId: input.customerId,
    expiryOption: input.expiryOption,
    expiresAt: calculateExpiresAt(input.expiryOption, now),
    note: input.note,
    dueAt: input.dueAt,
    allowPartialPayments: input.allowPartialPayments,
    depositType: input.depositType,
    depositValue: input.depositValue,
  };
}
