export type PaymentRequestStatus = 'pending' | 'confirming' | 'paid' | 'expired' | 'cancelled';

export type ExpiryOption = '1h' | '24h' | '7d' | 'never';

export interface PaymentRequest {
  id: string;
  paymentCode: string;
  amount: number;
  currency: 'USDC';
  network: 'Solana';
  description?: string;
  customerId?: string;
  expiryOption: ExpiryOption;
  expiresAt: string | null;
  note?: string;
  status: PaymentRequestStatus;
  createdAt: string;
  /** @deprecated Not a working public URL — see getPublicPaymentUrl(publicToken) instead. */
  paymentLink: string;
  /** Opaque public bearer token — the only safe identifier for a shareable checkout link. */
  publicToken: string;
  /** Solana Pay reference public key (no matching secret key exists anywhere) — null for requests created before Phase 3C. */
  solanaReference: string | null;
}

export interface Transaction {
  id: string;
  requestId: string;
  amount: number;
  currency: 'USDC';
  network: 'Solana';
  fromCustomerId: string;
  txHash: string;
  paidAt: string;
}

export type RequestEventType =
  | 'created'
  | 'shared'
  | 'payment_detected'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'reminder_sent'
  | 'cancelled'
  | 'expired';

export interface RequestEvent {
  id: string;
  requestId: string;
  type: RequestEventType;
  occurredAt: string;
}
