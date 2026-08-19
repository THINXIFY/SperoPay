import type { PaymentRequest } from '../types';

export function getInvoiceId(request: PaymentRequest): string {
  return `INV-${request.paymentCode}`;
}

export function getReceiptId(request: PaymentRequest): string {
  return `RCP-${request.paymentCode}`;
}
