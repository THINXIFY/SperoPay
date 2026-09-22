import type { PaymentRequest } from '../types';
import { getReceiptId } from './documentIds';
import { getPublicReceiptUrl } from './publicReceiptLink';

export function buildReceiptShareMessage(request: PaymentRequest): string {
  const receiptId = getReceiptId(request.paymentCode);
  const serviceClause = request.description ? ` for ${request.description}` : '';

  return `Payment Receipt ${receiptId}\n\n${request.amount} ${request.currency} received${serviceClause}.\n\nView receipt:\n${getPublicReceiptUrl(request.publicToken)}`;
}
