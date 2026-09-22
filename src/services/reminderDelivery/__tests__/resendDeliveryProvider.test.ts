import { ResendDeliveryProvider } from '../resendDeliveryProvider';
import type { ReminderDeliveryContext } from '../types';

const BASE_CONTEXT: ReminderDeliveryContext = {
  channel: 'email',
  customerName: 'Alex Morgan',
  customerEmail: 'alex@example.com',
  merchantName: 'Acme Studio',
  amount: 250,
  currency: 'USDC',
  paymentCode: 'SP-AAAAA',
  dueAt: null,
  message: 'Hi Alex,\n\nYour payment of 250 USDC is due today.\n\nYou can complete it using the payment link below.\nhttps://pay.speropay.app/p/token-1',
  paymentLink: 'https://pay.speropay.app/p/token-1',
};

function makeProvider(fetchImpl: jest.Mock) {
  return new ResendDeliveryProvider({ apiKey: 'test-api-key', fromEmail: 'reminders@speropay.app', fetchImpl: fetchImpl as unknown as typeof fetch });
}

describe('ResendDeliveryProvider', () => {
  it('sends a successful email and never leaks the API key into the request body', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const provider = makeProvider(fetchImpl);

    const result = await provider.send(BASE_CONTEXT);

    expect(result).toEqual({ delivered: true, channel: 'email' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer test-api-key');
    const body = JSON.parse(init.body);
    expect(body.to).toBe('alex@example.com');
    expect(body.from).toBe('reminders@speropay.app');
    expect(JSON.stringify(body)).not.toContain('test-api-key');
  });

  it('treats a missing customer email as a non-retryable, non-crashing failure', async () => {
    const fetchImpl = jest.fn();
    const provider = makeProvider(fetchImpl);

    const result = await provider.send({ ...BASE_CONTEXT, customerEmail: null });

    expect(result).toEqual({ delivered: false, reason: 'no_customer_email', retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats an obviously invalid customer email the same way, without crashing', async () => {
    const fetchImpl = jest.fn();
    const provider = makeProvider(fetchImpl);

    const result = await provider.send({ ...BASE_CONTEXT, customerEmail: 'not-an-email' });

    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('no_customer_email');
    expect(result.retryable).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('marks a 5xx provider failure as retryable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const provider = makeProvider(fetchImpl);

    const result = await provider.send(BASE_CONTEXT);

    expect(result.delivered).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.reason).toBe('resend_http_503');
  });

  it('marks a 429 rate-limit response as retryable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    const provider = makeProvider(fetchImpl);

    const result = await provider.send(BASE_CONTEXT);
    expect(result.retryable).toBe(true);
  });

  it('marks a 4xx rejection (e.g. invalid recipient) as permanent, not retryable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 422 });
    const provider = makeProvider(fetchImpl);

    const result = await provider.send(BASE_CONTEXT);

    expect(result.delivered).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.reason).toBe('resend_http_422');
  });

  it('treats a network-level failure (fetch throws) as retryable, never crashing the caller', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('network down'));
    const provider = makeProvider(fetchImpl);

    const result = await provider.send(BASE_CONTEXT);

    expect(result).toEqual({ delivered: false, reason: 'resend_network_error', retryable: true });
  });
});
