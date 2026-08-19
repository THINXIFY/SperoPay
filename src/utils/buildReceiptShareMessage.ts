import type { PaymentRequest } from '../types';
import { getReceiptId } from './documentIds';

export function buildReceiptShareMessage(request: PaymentRequest): string {
  const receiptId = getReceiptId(request);
  const serviceClause = request.description ? ` for ${request.description}` : '';

  return `Payment Receipt ${receiptId}\n\n${request.amount} ${request.currency} received${serviceClause}.`;
}
