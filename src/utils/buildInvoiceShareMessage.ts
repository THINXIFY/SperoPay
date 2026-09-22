import type { PaymentRequest, Profile } from '../types';
import { getInvoiceId } from './documentIds';
import { getPublicPaymentUrl } from './publicPaymentLink';
import { getPublicInvoiceUrl } from './publicInvoiceLink';

export function buildInvoiceShareMessage(request: PaymentRequest, profile: Profile): string {
  const businessName = profile.businessName?.trim() || profile.displayName || 'Your business';
  const invoiceId = getInvoiceId(request.paymentCode);
  const serviceClause = request.description ? ` for ${request.description}` : '';

  return `Invoice ${invoiceId}\n\n${businessName} requested ${request.amount} ${request.currency}${serviceClause}.\n\nView invoice:\n${getPublicInvoiceUrl(request.publicToken)}\n\nPay with Spero:\n${getPublicPaymentUrl(request.publicToken)}`;
}
