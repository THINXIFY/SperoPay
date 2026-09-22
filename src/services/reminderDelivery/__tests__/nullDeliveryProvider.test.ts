import { NullDeliveryProvider } from '../nullDeliveryProvider';
import { shouldRetryReminderDelivery } from '../shouldRetryReminderDelivery';
import type { ReminderDeliveryContext } from '../types';

const CONTEXT: ReminderDeliveryContext = {
  channel: 'email',
  merchantName: 'Acme Studio',
  amount: 250,
  currency: 'USDC',
  paymentCode: 'SP-AAAAA',
  message: 'Hi,\n\nYour payment of 250 USDC is due today.',
  paymentLink: 'https://pay.speropay.app/p/token-1',
};

describe('NullDeliveryProvider', () => {
  it('never claims delivery, and its result is never treated as retryable', async () => {
    const provider = new NullDeliveryProvider();
    const result = await provider.send(CONTEXT);

    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('no_automatic_delivery_provider_configured');
    expect(shouldRetryReminderDelivery(result)).toBe(false);
  });
});
