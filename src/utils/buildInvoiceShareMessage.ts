import type { PaymentRequest, Profile } from '../types';
import { getInvoiceId } from './documentIds';

export function buildInvoiceShareMessage(request: PaymentRequest, profile: Profile): string {
  const businessName = profile.businessName?.trim() || profile.displayName || 'Your business';
  const invoiceId = getInvoiceId(request);
  const serviceClause = request.description ? ` for ${request.description}` : '';

  return `Invoice ${invoiceId}\n\n${businessName} requested ${request.amount} ${request.currency}${serviceClause}.\n\nPay with Spero:\n${request.paymentLink}`;
}
