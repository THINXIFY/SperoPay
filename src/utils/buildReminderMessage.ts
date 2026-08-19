import type { PaymentRequest, Customer } from '../types';

export function buildReminderMessage(request: PaymentRequest, customer: Customer | undefined): string {
  const firstName = customer ? customer.name.split(' ')[0] : 'there';
  const descriptionClause = request.description ? ` for ${request.description}` : '';

  return `Hi ${firstName},\n\nJust a quick reminder that your ${request.amount} ${request.currency} payment${descriptionClause} is still pending.\n\nYou can complete it using your Spero payment link below.\n${request.paymentLink}`;
}
