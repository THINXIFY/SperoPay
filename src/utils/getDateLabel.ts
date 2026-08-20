import type { PaymentRequest, Transaction } from '../types';

export function getDateLabel(request: PaymentRequest, transaction?: Transaction): string {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (request.status === 'paid') return `Paid on ${formatDate(transaction?.paidAt ?? request.createdAt)}`;
  if (request.status === 'confirming') return 'Confirming payment…';
  if (request.status === 'cancelled') return 'Cancelled';
  if (request.status === 'expired')
    return `Expired on ${request.expiresAt ? formatDate(request.expiresAt) : formatDate(request.createdAt)}`;
  if (!request.expiresAt) return 'No expiry';

  const daysLeft = Math.ceil((new Date(request.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return daysLeft <= 0 ? 'Expires today' : `Expires in ${daysLeft}d`;
}
