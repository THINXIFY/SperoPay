export type PaymentRequestStatus = 'pending' | 'paid' | 'expired';

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
  paymentLink: string;
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

export type RequestEventType = 'created' | 'viewed' | 'paid' | 'expired';

export interface RequestEvent {
  id: string;
  requestId: string;
  type: RequestEventType;
  occurredAt: string;
}
